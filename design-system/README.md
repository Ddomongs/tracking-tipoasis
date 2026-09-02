# tracking-tipoasis design system bundle

Self-contained HTML previews of the tokens and components documented in `../DESIGN.md`.
Each file starts with a `<!-- @dsCard group="..." -->` marker so Claude Design can index it as a card.

Push to a Claude Design design-system project from an interactive Claude Code session:

1. Run `/design-login` once on this machine.
2. Ask Claude Code to sync `design-system/` to the "tracking-tipoasis" design-system project.

Files:

- `foundations/colors.html`, `foundations/typography.html`, `foundations/spacing.html`
- `components/buttons.html`, `components/cards.html`, `components/status.html`,
  `components/tracking-form.html`, `components/customer-cta.html`
