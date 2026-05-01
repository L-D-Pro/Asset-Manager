import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "./use-toast"

interface GamificationStats {
  totalXp: number
  currentLevel: number
  currentStreak: number
  longestStreak: number
  xpToNextLevel: number
  questsCompleted: number
  achievementsUnlocked: number
  activeQuests: Array<{
    id: number
    questId: number
    name: string
    description: string
    xpReward: number
    frequency: string
    progress: number
    criteriaValue: number
    status: string
    startedAt: string
  }>
  recentAchievements: Array<{
    id: number
    slug: string
    name: string
    description: string
    iconName: string
    unlockedAt: string
    seen: boolean
  }>
}

interface XpHistoryItem {
  id: number
  actionType: string
  xpAmount: number
  metadata: Record<string, unknown>
  createdAt: string
}

interface Achievement {
  id: number
  slug: string
  name: string
  description: string
  iconName: string
  xpReward: number
  criteriaType: string
  criteriaValue: number
  isHidden: boolean
}

interface UserAchievement {
  id: number
  userId: number
  achievementId: number
  unlockedAt: string
  seen: boolean
}

interface Quest {
  id: number
  slug: string
  name: string
  description: string
  xpReward: number
  frequency: string
  criteriaType: string
  criteriaValue: number
}

interface UserQuest {
  id: number
  userId: number
  questId: number
  progress: number
  status: string
  startedAt: string
  completedAt: string | null
}

const API_BASE = "/api/gamification"

export function useGamificationStats() {
  return useQuery({
    queryKey: ["gamification", "stats"],
    queryFn: async () => {
      const res = await fetch(API_BASE + "/stats", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch gamification stats")
      return res.json() as Promise<GamificationStats>
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useXpHistory() {
  return useQuery({
    queryKey: ["gamification", "xp", "history"],
    queryFn: async () => {
      const res = await fetch(API_BASE + "/xp/history", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch XP history")
      return res.json() as Promise<{ items: XpHistoryItem[]; total: number }>
    },
  })
}

export function useAchievements() {
  return useQuery({
    queryKey: ["gamification", "achievements"],
    queryFn: async () => {
      const res = await fetch(API_BASE + "/achievements", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch achievements")
      return res.json() as Promise<{ achievements: Achievement[]; unlocked: UserAchievement[] }>
    },
  })
}

export function useMarkAchievementSeen() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (achievementId: number) => {
      const res = await fetch(API_BASE + `/achievements/${achievementId}/seen`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to mark achievement seen")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification"] })
    },
  })
}

export function useQuests() {
  return useQuery({
    queryKey: ["gamification", "quests"],
    queryFn: async () => {
      const res = await fetch(API_BASE + "/quests", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch quests")
      return res.json() as Promise<{ active: UserQuest[]; completed: UserQuest[]; available: Quest[] }>
    },
  })
}

export function useAcceptQuest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (questId: number) => {
      const res = await fetch(API_BASE + `/quests/${questId}/accept`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to accept quest")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification"] })
      toast({ title: "Quest accepted!", description: "Start working toward your goal." })
    },
  })
}
