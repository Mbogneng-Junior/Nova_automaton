# Pipeline : Chatbot WhatsApp personnel

Chatbot WhatsApp propulsé par **Bedrock Claude** (Haiku 4.5) via Hermes.

## Pipeline

```text
Toi (WhatsApp) → Green API webhook → Hermes
    │
    Hermes comprend l'intention
    ├──► Si conversation → répond via Bedrock Claude
    ├──► Si commande → déclenche workflow n8n / API
    └──► Si validation HITL → tool-hitl-reply-router
```

> **Note** : WhatsApp est le canal secondaire. Telegram via Hermes est le canal primaire.
> Ce chatbot reste utile pour les interactions rapides depuis le téléphone.

## Structure

- `n8n/` : workflows n8n exportés (webhook Green API → Hermes)
