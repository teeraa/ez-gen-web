"use client"

import { useEffect, useState } from "react"
import { charactersApi } from "@/lib/api"
import type { CharacterProfileDTO } from "@/types/api"

// Loads full profiles for the given IDs, preserving order; profiles that fail to load
// (deleted / not owned) are dropped rather than failing the whole list.
export function useCharacterProfiles(ids: string[]): CharacterProfileDTO[] {
  const key = ids.join(",")
  const [loaded, setLoaded] = useState<{ key: string; profiles: CharacterProfileDTO[] }>({ key: "", profiles: [] })

  useEffect(() => {
    if (!key) return
    let cancelled = false
    Promise.all(key.split(",").map(id => charactersApi.get(id).catch(() => null)))
      .then(results => {
        if (!cancelled) setLoaded({ key, profiles: results.filter((p): p is CharacterProfileDTO => p !== null) })
      })
    return () => { cancelled = true }
  }, [key])

  return key && loaded.key === key ? loaded.profiles : []
}

export function sceneCharacterIds(scene: { characters?: { id: string; sortOrder: number }[]; characterProfileId?: string | null }): string[] {
  if (scene.characters && scene.characters.length > 0) {
    return [...scene.characters].sort((a, b) => a.sortOrder - b.sortOrder).map(c => c.id)
  }
  // Pre-migration responses only carry the deprecated single field.
  return scene.characterProfileId ? [scene.characterProfileId] : []
}
