import { useState, useEffect } from 'react';
import { LeaderboardType, FilterType, Petal, LeaderData } from '../types';
import { projectsData } from '../data/leaderboardData';
import { getLeaderboard } from '../../../shared/api/client';
import { FallingPetals } from '../components/FallingPetals';
import { LeaderboardTypeToggle } from '../components/LeaderboardTypeToggle';
import { LeaderboardHero } from '../components/LeaderboardHero';
import { ContributorsPodium } from '../components/ContributorsPodium';
import { ProjectsPodium } from '../components/ProjectsPodium';
import { FiltersSection } from '../components/FiltersSection';
import { ContributorsTable } from '../components/ContributorsTable';
import { ProjectsTable } from '../components/ProjectsTable';
import { LeaderboardStyles } from '../components/LeaderboardStyles';

export function LeaderboardPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('overall');
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('contributors');
  const [showEcosystemDropdown, setShowEcosystemDropdown] = useState(false);
  const [selectedEcosystem, setSelectedEcosystem] = useState('All Ecosystems');
  const [petals, setPetals] = useState<Petal[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (leaderboardType === 'contributors') {
        setIsLoading(true);
        setError(null);
        try {
          const data = await getLeaderboard(10);
          // Transform API data to match LeaderData type
          const transformedData: LeaderData[] = data.map((item) => ({
            rank: item.rank,
            username: item.username,
            avatar: item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username)}&background=c9983a&color=fff&size=128`,
            score: item.score,
            trend: item.trend,
            trendValue: item.trendValue,
            contributions: item.contributions,
            ecosystems: item.ecosystems || [],
          }));
          setLeaderboardData(transformedData);
        } catch (err) {
          console.error('Failed to fetch leaderboard:', err);
          setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
          // Fallback to empty array
          setLeaderboardData([]);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchLeaderboard();
  }, [leaderboardType]);

  // Generate falling petals on mount
  useEffect(() => {
    const generatePetals = () => {
      const newPetals: Petal[] = [];
      for (let i = 0; i < 30; i++) {
        newPetals.push({
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 5,
          duration: 8 + Math.random() * 6,
          rotation: Math.random() * 360,
          size: 0.6 + Math.random() * 0.8,
        });
      }
      setPetals(newPetals);
    };

    generatePetals();
    setTimeout(() => setIsLoaded(true), 100);

    // Regenerate petals every 15 seconds for continuous effect
    const interval = setInterval(generatePetals, 15000);
    return () => clearInterval(interval);
  }, []);

  // Ensure we have at least 3 items for the podium (pad with empty data if needed)
  const contributorTopThree: LeaderData[] = [
    ...leaderboardData.slice(0, 3),
    ...Array(Math.max(0, 3 - leaderboardData.length)).fill(null).map((_, i) => ({
      rank: leaderboardData.length + i + 1,
      username: '-',
      avatar: '👤',
      score: 0,
      trend: 'same' as const,
      trendValue: 0,
      contributions: 0,
      ecosystems: [],
    })),
  ].slice(0, 3) as LeaderData[];
  
  const projectTopThree = projectsData.slice(0, 3);

  return (
    <div className="space-y-6 relative">
      {/* Falling Golden Petals - Full Page */}
      <FallingPetals petals={petals} />

      {/* Leaderboard Type Toggle - Floating Above Everything */}
      <LeaderboardTypeToggle
        leaderboardType={leaderboardType}
        onToggle={setLeaderboardType}
        isLoaded={isLoaded}
      />

      {/* Hero Header Section */}
      <LeaderboardHero leaderboardType={leaderboardType} isLoaded={isLoaded}>
        {/* Top 3 Podium - Contributors */}
        {leaderboardType === 'contributors' && leaderboardData.length > 0 && (
          <ContributorsPodium topThree={contributorTopThree} isLoaded={isLoaded} />
        )}
        {leaderboardType === 'contributors' && leaderboardData.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            No contributors yet. Be the first to contribute!
          </div>
        )}

        {/* Top 3 Podium - Projects */}
        {leaderboardType === 'projects' && (
          <ProjectsPodium topThree={projectTopThree} isLoaded={isLoaded} />
        )}
      </LeaderboardHero>

      {/* Filters Section */}
      <FiltersSection
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        selectedEcosystem={selectedEcosystem}
        onEcosystemChange={setSelectedEcosystem}
        showDropdown={showEcosystemDropdown}
        onToggleDropdown={() => setShowEcosystemDropdown(!showEcosystemDropdown)}
        isLoaded={isLoaded}
      />

      {/* Leaderboard Table - Contributors */}
      {leaderboardType === 'contributors' && (
        <>
          {isLoading && (
            <div className="text-center py-12 text-gray-500">
              Loading leaderboard...
            </div>
          )}
          {error && (
            <div className="text-center py-12 text-red-500">
              {error}
            </div>
          )}
          {!isLoading && !error && (
            <ContributorsTable
              data={leaderboardData}
              activeFilter={activeFilter}
              isLoaded={isLoaded}
            />
          )}
        </>
      )}

      {/* Leaderboard Table - Projects */}
      {leaderboardType === 'projects' && (
        <ProjectsTable
          data={projectsData}
          activeFilter={activeFilter}
          isLoaded={isLoaded}
        />
      )}

      {/* CSS Animations */}
      <LeaderboardStyles />
    </div>
  );
}
