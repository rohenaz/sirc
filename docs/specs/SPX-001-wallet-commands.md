# SPX-001: SIRC Wallet Commands Specification

**Status:** Draft
**Version:** 0.1.0
**Authors:** SIRC Team
**Created:** 2024-11-24

## Abstract

This document defines the SIRC Protocol Extension (SPX) for cryptocurrency wallet commands. Since no IRC standard exists for cryptocurrency operations, this specification establishes a client-side command protocol that integrates with the IRC user experience while keeping blockchain operations local.

## Motivation

IRC clients have historically used slash commands (`/msg`, `/join`, `/nick`) for client-side operations. Cryptocurrency wallet operations fit naturally into this paradigm - they are user-initiated, client-local, and should not be transmitted over the IRC protocol itself.

## Design Principles

1. **Client-Side Only**: Wallet commands are processed locally, never sent to IRC servers
2. **Familiar Syntax**: Use IRC-style `/command` format users already know
3. **Explicit Coin Selection**: Always specify which cryptocurrency for clarity
4. **Confirmation Required**: Destructive operations require explicit confirmation
5. **Privacy First**: No wallet data transmitted over IRC unless explicitly sending funds

## Command Architecture

### Command Flow

```
User Input: /balance bsv
      │
      ▼
┌─────────────────────────────┐
│   Frontend: ChatInput       │
│   Intercept /wallet cmds    │
└─────────────────────────────┘
      │
      ▼
┌─────────────────────────────┐
│   WalletService (Go)        │
│   Process command locally   │
└─────────────────────────────┘
      │
      ▼
┌─────────────────────────────┐
│   Display result in chat    │
│   (local system message)    │
└─────────────────────────────┘
```

### Command Interception Point

Commands are intercepted in the frontend before reaching `SendMessage`:

```typescript
// frontend/app/page.tsx - ChatInput component
const handleSend = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!message.trim()) return;

  // Check for wallet commands (never send to IRC)
  if (message.startsWith('/')) {
    const handled = await handleWalletCommand(message);
    if (handled) {
      setMessage("");
      return;
    }
  }

  // Regular IRC message
  await SendMessage(serverId, channel, message);
  setMessage("");
};
```

## Core Commands

### `/balance` - Check Wallet Balance

**Syntax:**
```
/balance [coin]
```

**Parameters:**
- `coin` (optional): `bsv` | `sol` - Defaults to showing all balances

**Examples:**
```
/balance           → Shows all balances
/balance bsv       → Shows BSV balance only
/balance sol       → Shows SOL balance only
```

**Response (displayed as system message):**
```
━━━ Wallet Balance ━━━
BSV:  0.00234500 BSV (~$0.12 USD)
SOL:  1.234567890 SOL (~$185.00 USD)
━━━━━━━━━━━━━━━━━━━━━
```

**Backend Method:**
```go
// pkg/services/wallet_service.go
func (s *WalletService) GetBalance(coin string) (*BalanceResponse, error)
```

---

### `/send` - Send Cryptocurrency

**Syntax:**
```
/send <recipient> <amount> <coin> [memo]
```

**Parameters:**
- `recipient` (required): IRC nick, blockchain address, or paymail
- `amount` (required): Decimal amount to send
- `coin` (required): `bsv` | `sol`
- `memo` (optional): Transaction memo/note

**Recipient Types:**
| Type | Example | Resolution |
|------|---------|------------|
| IRC Nick | `alice` | Lookup nick's registered wallet address |
| Address | `1BvBM...` | Direct blockchain address |
| Paymail | `alice@example.com` | BRC-compliant paymail resolution |

**Examples:**
```
/send alice 0.001 bsv                    → Send to IRC user
/send alice 0.001 bsv Thanks for help!   → With memo
/send 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 0.01 bsv   → Direct address
/send alice@money.button 0.001 bsv       → Paymail address
```

**Confirmation Flow:**
```
You: /send alice 0.001 bsv Thanks!

[WALLET] Confirm transaction:
         To: alice (1BvBM...N2)
         Amount: 0.001 BSV (~$0.05 USD)
         Fee: ~0.00000250 BSV
         Memo: "Thanks!"

         Type /confirm to send or /cancel to abort.

You: /confirm

[WALLET] Transaction sent!
         TX: abc123...def456
         Status: Broadcasting...
```

**Backend Method:**
```go
// pkg/services/wallet_service.go
func (s *WalletService) PrepareSend(recipient, amount, coin, memo string) (*PendingTx, error)
func (s *WalletService) ConfirmSend(txID string) (*TxResult, error)
func (s *WalletService) CancelSend(txID string) error
```

---

### `/deposit` - Show Deposit Address

**Syntax:**
```
/deposit <coin>
```

**Parameters:**
- `coin` (required): `bsv` | `sol`

**Examples:**
```
/deposit bsv
/deposit sol
```

**Response:**
```
━━━ BSV Deposit Address ━━━
1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa

Send BSV to this address to fund your wallet.
This address is unique to your SIRC wallet.
━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### `/withdraw` - Withdraw to External Address

**Syntax:**
```
/withdraw <address> <amount> <coin>
```

**Parameters:**
- `address` (required): External blockchain address
- `amount` (required): Decimal amount or `all` for full balance
- `coin` (required): `bsv` | `sol`

**Examples:**
```
/withdraw 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 0.01 bsv
/withdraw 7xKXtg...AsU 0.5 sol
/withdraw 1BvBM...N2 all bsv    → Withdraw entire balance
```

**Confirmation Required:** Same flow as `/send`

---

### `/history` - Transaction History

**Syntax:**
```
/history [coin] [count]
```

**Parameters:**
- `coin` (optional): `bsv` | `sol` - Filter by coin
- `count` (optional): Number of transactions (default: 10, max: 50)

**Examples:**
```
/history              → Last 10 transactions (all coins)
/history bsv          → Last 10 BSV transactions
/history sol 5        → Last 5 SOL transactions
```

**Response:**
```
━━━ Transaction History (BSV) ━━━
1. ↑ SENT    0.001 BSV to alice       2h ago   ✓
2. ↓ RECV    0.005 BSV from bob       1d ago   ✓
3. ↑ SENT    0.002 BSV to 1BvBM...    3d ago   ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### `/wallet` - Wallet Status & Management

**Syntax:**
```
/wallet [subcommand]
```

**Subcommands:**
| Subcommand | Description |
|------------|-------------|
| (none) | Show wallet overview |
| `lock` | Lock wallet (require password to use) |
| `unlock` | Unlock wallet with password |
| `backup` | Show seed phrase (requires confirmation) |
| `register` | Register wallet address with NickServ identity |

**Examples:**
```
/wallet                → Show overview
/wallet lock           → Lock wallet
/wallet unlock         → Prompt for password
/wallet register       → Link wallet to IRC identity
```

---

### `/price` - Get Current Price

**Syntax:**
```
/price <coin>
```

**Examples:**
```
/price bsv
/price sol
```

**Response:**
```
━━━ BSV Price ━━━
$52.34 USD
24h: +2.3% | 7d: -1.2%
Source: CoinGecko
━━━━━━━━━━━━━━━━
```

---

## Confirmation Commands

### `/confirm` - Confirm Pending Transaction

Used after `/send` or `/withdraw` to confirm the transaction.

```
/confirm
```

### `/cancel` - Cancel Pending Transaction

Used to abort a pending `/send` or `/withdraw`.

```
/cancel
```

---

## Identity Integration

### NickServ-Wallet Linking

Users can link their wallet address to their NickServ identity, enabling:
- Receiving tips via IRC nick
- Identity verification for large transfers

**Registration Flow:**
```
You: /wallet register

[WALLET] To register your wallet with NickServ:
         1. You must be identified with NickServ
         2. Your BSV address: 1A1zP1...DivfNa
         3. Your SOL address: 7xKXtg...AsU

         This links your IRC identity to your wallet.
         Others can send you crypto using your nick.

         Type /confirm to register or /cancel to abort.
```

**Storage:**
- Mapping stored locally: `~/.config/sirc/wallet/identities.json`
- Format: `{ "nick": { "bsv": "address", "sol": "address" } }`

### Address Lookup

When sending to an IRC nick, SIRC:
1. Checks local identity cache
2. Falls back to asking user for address if not found

---

## Error Handling

### Error Response Format

```
[WALLET ERROR] <error_code>: <message>
               <recovery_suggestion>
```

### Error Codes

| Code | Message | Recovery |
|------|---------|----------|
| `E001` | Wallet is locked | Use `/wallet unlock` |
| `E002` | Insufficient balance | Check `/balance`, need X more |
| `E003` | Invalid address format | Check address format for coin |
| `E004` | Recipient not found | Ask for their wallet address |
| `E005` | Network error | Retry in a few seconds |
| `E006` | Daily limit exceeded | Wait until limit resets |
| `E007` | Transaction failed | Check TX hash for details |

---

## Security Considerations

### Command Privacy

- Wallet commands are **never** sent to IRC servers
- All processing happens client-side
- No wallet data in IRC logs

### Password Protection

- Wallet locked by default after 5 minutes idle
- Large transactions require password re-entry
- Configurable in settings

### Rate Limiting

- Max 10 transactions per hour (configurable)
- Cooldown between rapid sends
- Prevents accidental double-sends

---

## Implementation Checklist

### Phase 1: Core Commands
- [ ] `/balance` - Read-only balance check
- [ ] `/deposit` - Show deposit addresses
- [ ] `/price` - Price lookup

### Phase 2: Transactions
- [ ] `/send` - Send to address
- [ ] `/withdraw` - Withdraw to external
- [ ] `/confirm` / `/cancel` - Confirmation flow
- [ ] `/history` - Transaction history

### Phase 3: Identity
- [ ] `/wallet register` - NickServ linking
- [ ] Nick-to-address resolution
- [ ] `/wallet lock/unlock` - Security

---

## Wire Format (Future: P2P Tips)

For future peer-to-peer tip notifications between SIRC clients, we reserve CTCP:

```
CTCP TIP <version> <coin> <amount> <txhash> <memo>
```

**Example:**
```
:alice!user@host PRIVMSG bob :\x01TIP 1 bsv 0.001 abc123...def456 Thanks!\x01
```

This is **optional** and only used if both parties run SIRC. Non-SIRC clients will see it as a regular CTCP message.

---

## References

- [CTCP Specification](https://www.irchelp.org/protocol/ctcpspec.html)
- [DCC Specification](https://modern.ircdocs.horse/dcc)
- [BRC-100 Wallet Interface](https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md)
- [Solana Web3.js](https://solana.com/docs/clients/javascript)

---

## Changelog

### v0.1.0 (Draft)
- Initial specification
- Core commands: `/balance`, `/send`, `/deposit`, `/withdraw`, `/history`, `/wallet`, `/price`
- Confirmation flow design
- NickServ identity integration concept
