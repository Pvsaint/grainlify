package handlers

import (
	"log/slog"

	"github.com/gofiber/fiber/v2"

	"github.com/jagadeesh/grainlify/backend/internal/db"
)

type LeaderboardHandler struct {
	db *db.DB
}

func NewLeaderboardHandler(d *db.DB) *LeaderboardHandler {
	return &LeaderboardHandler{db: d}
}

// Leaderboard returns top contributors ranked by contributions in verified projects
func (h *LeaderboardHandler) Leaderboard() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if h.db == nil || h.db.Pool == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "db_not_configured"})
		}

		// Get limit from query params (default 10, max 100)
		limit := c.QueryInt("limit", 10)
		if limit < 1 {
			limit = 10
		}
		if limit > 100 {
			limit = 100
		}

		// Query top contributors by contribution count in verified projects
		// Contributions = issues + PRs in verified projects only
		rows, err := h.db.Pool.Query(c.Context(), `
SELECT 
  ga.login as username,
  COALESCE(ga.avatar_url, '') as avatar_url,
  u.id as user_id,
  (
    SELECT COUNT(*) 
    FROM github_issues i
    INNER JOIN projects p ON i.project_id = p.id
    WHERE i.author_login = ga.login AND p.status = 'verified'
  ) +
  (
    SELECT COUNT(*) 
    FROM github_pull_requests pr
    INNER JOIN projects p ON pr.project_id = p.id
    WHERE pr.author_login = ga.login AND p.status = 'verified'
  ) as contribution_count,
  COALESCE(
    (
      SELECT ARRAY_AGG(DISTINCT e.name)
      FROM (
        SELECT DISTINCT p.ecosystem_id
        FROM github_issues i
        INNER JOIN projects p ON i.project_id = p.id
        WHERE i.author_login = ga.login AND p.status = 'verified'
        UNION
        SELECT DISTINCT p.ecosystem_id
        FROM github_pull_requests pr
        INNER JOIN projects p ON pr.project_id = p.id
        WHERE pr.author_login = ga.login AND p.status = 'verified'
      ) contrib_ecosystems
      INNER JOIN ecosystems e ON contrib_ecosystems.ecosystem_id = e.id
      WHERE e.status = 'active'
    ),
    ARRAY[]::TEXT[]
  ) as ecosystems
FROM github_accounts ga
INNER JOIN users u ON ga.user_id = u.id
WHERE (
  SELECT COUNT(*) 
  FROM github_issues i
  INNER JOIN projects p ON i.project_id = p.id
  WHERE i.author_login = ga.login AND p.status = 'verified'
) +
(
  SELECT COUNT(*) 
  FROM github_pull_requests pr
  INNER JOIN projects p ON pr.project_id = p.id
  WHERE pr.author_login = ga.login AND p.status = 'verified'
) > 0
ORDER BY contribution_count DESC, ga.login ASC
LIMIT $1
`, limit)
		if err != nil {
			slog.Error("failed to fetch leaderboard",
				"error", err,
			)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "leaderboard_fetch_failed"})
		}
		defer rows.Close()

		var leaderboard []fiber.Map
		rank := 1
		for rows.Next() {
			var username string
			var avatarURL *string
			var userID string
			var contributionCount int
			var ecosystems []string

			if err := rows.Scan(&username, &avatarURL, &userID, &contributionCount, &ecosystems); err != nil {
				slog.Error("failed to scan leaderboard row",
					"error", err,
				)
				continue
			}

			// Default avatar if not set
			avatar := ""
			if avatarURL != nil && *avatarURL != "" {
				avatar = *avatarURL
			}

			// Ensure ecosystems is not nil
			if ecosystems == nil {
				ecosystems = []string{}
			}

			leaderboard = append(leaderboard, fiber.Map{
				"rank":           rank,
				"username":       username,
				"avatar":         avatar,
				"user_id":        userID,
				"contributions":  contributionCount,
				"ecosystems":     ecosystems,
				// For now, set trend to 'same' and score to contribution count
				// These can be enhanced later with historical data
				"score":      contributionCount,
				"trend":      "same",
				"trendValue": 0,
			})
			rank++
		}

		// Always return an array, even if empty
		if leaderboard == nil {
			leaderboard = []fiber.Map{}
		}

		return c.Status(fiber.StatusOK).JSON(leaderboard)
	}
}

