# Awesome Design Systems: Install Status and Usage Guide

## Status

- Verified installed for Codex on this machine.
- Codex skill path: `C:\Users\sujit\.codex\skills\awesome-design-systems`
- Local repo clone: `C:\Users\sujit\.codex\vendor_imports\awesome-design-systems`
- Main catalog file: `C:\Users\sujit\.codex\vendor_imports\awesome-design-systems\README.md`

## What Is Installed vs Not Possible

### Installed

The repository is already available to Codex chats through the `awesome-design-systems` skill. Codex can use the local clone directly when you ask for design-system inspiration, comparisons, or examples.

### Can't Follow

`can't follow ; make one local install automatically available to all normal ChatGPT chats, custom GPTs, Projects, and other products ; those products do not share Codex's local filesystem or skill registry`

### Alternate Method

Use one of these per product surface:

- Codex chats: already works through the installed skill.
- Regular ChatGPT chats: upload the catalog `README.md` into the chat, or paste selected sections.
- ChatGPT Projects: upload `README.md` as a Project file so all chats in that Project can use it.
- Custom GPTs: add the catalog `README.md` as Knowledge in the GPT builder.
- GPT Actions or APIs: keep the repo in your own storage and expose it through your app, retrieval layer, or vector store.

## How To Use In Codex

### What to say

Use prompts like:

- `Use awesome-design-systems to find 5 banking design systems with public source code.`
- `Compare government design systems from the catalog and shortlist the best references for forms and accessibility.`
- `Search the local awesome-design-systems repo for travel brands with strong component libraries.`

### What Codex can access locally

Codex can directly inspect:

- `C:\Users\sujit\.codex\vendor_imports\awesome-design-systems\README.md`
- `C:\Users\sujit\.codex\vendor_imports\awesome-design-systems\.git`

### Useful local search patterns

```powershell
rg -n "bank|finance|insurance" C:\Users\sujit\.codex\vendor_imports\awesome-design-systems\README.md
rg -n "government|public sector|accessibility" C:\Users\sujit\.codex\vendor_imports\awesome-design-systems\README.md
rg -n "travel|airline|hospitality" C:\Users\sujit\.codex\vendor_imports\awesome-design-systems\README.md
```

## How To Use In Regular ChatGPT Chats

Regular ChatGPT chats cannot read `C:\Users\sujit\.codex\...` directly.

### Method

1. Open `C:\Users\sujit\.codex\vendor_imports\awesome-design-systems\README.md`.
2. Upload that file into a ChatGPT conversation.
3. Prompt ChatGPT with a task that tells it how to filter the catalog.

### Prompt template

```text
Use the uploaded awesome-design-systems catalog as a discovery index.
Find 5 strong references for [industry/use case].
For each one, tell me:
- why it matches
- whether it has components
- whether it has voice and tone guidance
- whether it has a designer kit
- whether public source code is linked
Do not dump the whole catalog. Curate only the strongest matches.
```

## How To Use In ChatGPT Projects

Projects can share uploaded files across chats inside that Project.

### Method

1. Create or open a Project in ChatGPT.
2. Upload `C:\Users\sujit\.codex\vendor_imports\awesome-design-systems\README.md` into the Project files.
3. Start chats inside that Project and reference the catalog as a shared source.

### Recommended project instruction

```text
Treat the uploaded awesome-design-systems catalog as a shortlist source for public design systems.
Prefer curated recommendations over exhaustive lists.
When stakes are high, recommend checking the official design-system site after selecting candidates.
```

## How To Use In Custom GPTs

Custom GPTs cannot see local Codex files unless you upload them as Knowledge.

### Method

1. Open the GPT builder.
2. Add `C:\Users\sujit\.codex\vendor_imports\awesome-design-systems\README.md` to Knowledge.
3. Add instructions so the GPT uses the file as an index, not as final truth.

### Recommended GPT instructions

```text
Use the uploaded awesome-design-systems catalog as a discovery reference for public design systems.
Return 3 to 7 curated matches unless the user explicitly asks for more.
Explain why each match fits the user's domain, product type, or visual direction.
Treat the catalog as a starting point and suggest checking the official system docs for current details.
```

## How To Use In API or App-Based Retrieval

If you want the same source available across many tools, the practical shared method is to host the catalog yourself.

### Good options

- Put the repo or `README.md` in a shared folder like Google Drive, GitHub, or internal docs.
- Ingest the file into your retrieval pipeline or vector store.
- Expose it through your own app for ChatGPT Actions or internal assistants.

### Best format to ingest

The repo is mostly a discovery list, so the main useful file is:

- `C:\Users\sujit\.codex\vendor_imports\awesome-design-systems\README.md`

## Suggested Operating Model

If you want one source used in many places, use this split:

- Codex: use the existing installed skill.
- ChatGPT chats: upload the README when needed.
- Projects: upload once per Project.
- Custom GPTs: add the README as Knowledge.
- Apps and APIs: host or ingest the README into retrieval.

## Verified Local Paths

- Skill file: `C:\Users\sujit\.codex\skills\awesome-design-systems\SKILL.md`
- Repo location note: `C:\Users\sujit\.codex\skills\awesome-design-systems\references\repo-location.md`
- Upstream clone: `C:\Users\sujit\.codex\vendor_imports\awesome-design-systems`
- Catalog README: `C:\Users\sujit\.codex\vendor_imports\awesome-design-systems\README.md`
