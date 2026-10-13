# Legacy Fortress Brand Application Guide

## Tokens

Use the canonical variables in `app/globals.css` and the definitions in `LEGACY_FORTRESS_DESIGN_SYSTEM.md`. Core values are ink `#2B1714`, text `#1F1715`, secondary `#6B5F5A`, accent `#8C4A32`, tint `#F3EBE6`, canvas `#FAF8F6`, sidebar `#F5F1ED`, surface `#FFFFFF`, border `#EBE4DE`, divider `#F3EEEA` and dashed `#D9CFC8`.

## Typography

Customer UI uses `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`. Page title is 28/34 desktop and 34/41 mobile. Body is 15/22, metadata 13/18, navigation 14px. Money uses tabular numerals and dates are labelled `Updated 17 Jul 2026`.

## Interaction grammar

- row/card: existing object;
- `+`: add/create;
- pencil: edit;
- chevron: open/view;
- lock: restricted;
- bell: events;
- small info control: unfamiliar explanation only;
- primary button: one main action;
- secondary/text actions: ordinary and consequential operations respectively.

Use `components/ui/Icon.tsx`, `components/ui/LFDesignSystem.tsx` and existing drawer/sheet primitives. Do not introduce a local visual equivalent.

## Responsive contract

Desktop uses a 264px sidebar, 60px header and 960px preferred content width. Below 768px use the approved mobile navigation and grouped-list layout, 44px minimum touch targets, safe-area spacing and no horizontal overflow. Drawers become viewport-safe sheets or pushed screens.

## Brand safety

Never use relationship, IDV, executor or death evidence as a visual shortcut for access. The interface may explain a locked state, but it must not imply an authority or permission the canonical model does not provide.

