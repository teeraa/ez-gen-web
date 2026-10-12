// MOCK AUTH — prototype only. Real authentication belongs to ez-gen-api (see CLAUDE.md:
// "Do not implement real authentication in this phase"). Import only from server code.
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto"

export interface MockUser {
  id: string
  name: string
  email: string
  plan: string
}

interface StoredAccount extends MockUser {
  salt: string
  passwordHash: string
}

export const DEMO_ACCOUNT = {
  email: "demo@ezgen.studio",
  password: "violet1234",
} as const

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex")
}

function createAccount(user: Omit<MockUser, "id">, password: string, id: string = randomUUID()): StoredAccount {
  const salt = randomBytes(16).toString("hex")
  return { ...user, id, salt, passwordHash: hashPassword(password, salt) }
}

// globalThis keeps sign-ups alive across dev HMR reloads; they still vanish on server restart.
const store = globalThis as typeof globalThis & { __ezgenMockAccounts?: Map<string, StoredAccount> }

function accounts(): Map<string, StoredAccount> {
  if (!store.__ezgenMockAccounts) {
    const demo = createAccount(
      { name: "Demo Creator", email: DEMO_ACCOUNT.email, plan: "Creator plan" },
      DEMO_ACCOUNT.password,
      "demo-user",
    )
    store.__ezgenMockAccounts = new Map([[demo.email, demo]])
  }
  return store.__ezgenMockAccounts
}

function toUser({ id, name, email, plan }: StoredAccount): MockUser {
  return { id, name, email, plan }
}

export function verifyCredentials(email: string, password: string): MockUser | null {
  const account = accounts().get(email.trim().toLowerCase())
  if (!account) return null
  const actual = Buffer.from(hashPassword(password, account.salt), "hex")
  const expected = Buffer.from(account.passwordHash, "hex")
  return timingSafeEqual(actual, expected) ? toUser(account) : null
}

export function registerAccount(name: string, email: string, password: string): MockUser | "exists" {
  const key = email.trim().toLowerCase()
  if (accounts().has(key)) return "exists"
  const account = createAccount({ name: name.trim(), email: key, plan: "Free trial" }, password)
  accounts().set(key, account)
  return toUser(account)
}

export function findUserById(id: string): MockUser | null {
  for (const account of accounts().values()) {
    if (account.id === id) return toUser(account)
  }
  return null
}
