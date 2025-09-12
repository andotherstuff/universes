# Universes

A modern Nostr client for decentralized communities with Discord-like chat. Built with React, TypeScript, and the latest Nostr protocols.

## 🚀 Quick Start

```bash
git clone <repository-url>
cd universes
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## 🏗️ Tech Stack

- **React 18** + **TypeScript** + **Vite**
- **TailwindCSS** + **shadcn/ui** components
- **Nostrify** + **nostr-tools** for Nostr protocol
- **TanStack Query** for data fetching

## 🔌 Nostr Protocol Features

### Supported NIPs (Nostr Implementation Possibilities)

- **NIP-01** - Basic protocol flow
- **NIP-02** - Contact lists and petnames  
- **NIP-04** - Encrypted direct messages (legacy)
- **NIP-05** - DNS-based verification
- **NIP-07** - Browser extension signing
- **NIP-10** - Text note references and threading
- **NIP-19** - Bech32-encoded identifiers
- **NIP-22** - Comment threads
- **NIP-28** - Public chat channels
- **NIP-44** - Encrypted direct messages (modern)
- **NIP-57** - Lightning zaps
- **NIP-72** - Moderated communities
- **NIP-94** - File metadata

### Custom Event Kinds

The app may use custom event kinds for specific features. See `NIP.md` (if present) for documentation of any custom protocol extensions.

### Core Feature Implementation

| **System** | **Component** | **Event Kind(s)** | **NIP** | **Replaceable** | **Purpose** | **Key Tags** |
|------------|---------------|-------------------|---------|-------------|-------------|--------------|
| **Communities** | Community Definition | `34550` | NIP-72 | ✓ | Community metadata and moderator lists | `d` (ID), `name`, `description`, `p` (moderators) |
| | Member Management | `34551/34552/34553` | NIP-72 Ext | ✓ | Approved/declined/banned member lists | `d` (community ref), `p` (member pubkeys) |
| | | | | | *Note: Membership can be explicit (via 34551-34553 events) or implicit (community creator/moderators)* | |
| | Content Reporting | `1984` | NIP-56 | | Report content/users for moderation | `e` (target event), `p` (target user), report type |
| **Channels** | Channel Definition | `32807` | | ✓ | Channel metadata within communities | `d` (ID), `name`, `a` (community ref) |
| | *Channel Definition (Proposed)* | *`32807`* | | *✓* | *Proper addressable event references* | *`a` (`"34550:pubkey:universes"`)* |
| | Channel Permissions | `30143` | | ✓ | Access control for channels | `d` (community:channel), JSON content, `p` (user permissions) |
| | Channel Messages | `9411` | NIP-28 | | Real-time chat in channels | `a` (community), `t` (channel), `e` (thread) |
| | Message Replies | `1111` | NIP-22 | | Replies to any message (9411, 1, etc.) | `e` (root message), `p` (root author) |
| | Community Posts | `1111` | NIP-22 | | Threaded discussions | `A` (root community), `e` (parent), `k` (parent kind) |
| **Direct Messages** | Legacy DMs | `4` | NIP-04 | | Simple encrypted messages | `#p` (recipient), `authors` (sender) |
| | Modern DMs | `1059` | NIP-17 | | Gift-wrapped encrypted messages | `#p` (recipient) |

## 🧪 Testing

```bash
npm test
```

---

**Vibed with [MKStack](https://soapbox.pub/mkstack)** ⚡
