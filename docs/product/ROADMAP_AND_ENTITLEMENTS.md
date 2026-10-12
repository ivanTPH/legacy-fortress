# Legacy Fortress Roadmap and Entitlements

Status: current working product specification, 12 October 2026

This document records the agreed order of product work. It is a product
direction document, not a claim that every item below is implemented.

## Delivery order

1. Finish invitation acceptance and the Linked Fortresses journey.
2. Runtime-prove relationship/access isolation.
3. Complete biometric identity verification: photo ID, document verification,
   live camera, liveness, face comparison, consent, audit, exact
   account/invitation/access-request binding and replay/cross-account
   protection.
4. Build central Free / Legacy Fortress+ entitlement architecture.
5. Build subscription and trial UX.
6. Add premium asset limits and discovery.
7. Build Connected Estate and financial integrations.
8. Add a lightweight iOS/Android application distribution layer.
9. Continue safe legacy retirement throughout.

## Free working specification

Legacy Fortress Free includes a basic Personal Vault/profile, one main
residential property, one bank account, one savings record, one pension, up to
two digital accounts, a configurable small allowance of basic possessions,
basic Action Centre/security/account functionality and up to two trusted-person
invitations per eligible basic asset/relationship, subject to final entitlement
design.

Receiving and accepting legitimate invitations remains free. Linked Fortresses
remains available to recipients. Limits must never make existing records look
unavailable; they apply to eligible new additions or capabilities.

## Legacy Fortress+ working specification

The indicative price is **£2.99/month**. The entitlement model must also
support a monthly rolling subscription, a discounted annual subscription and a
possible one-month free trial. A trial may require a validated payment method.

Before activation, the customer must be told the trial duration, post-trial
price, billing frequency, renewal and cancellation terms.

Plus is intended to support multiple records, additional properties,
investments, insurance, business interests, the Will/document/executor and
LPA/capacity journeys, expanded or unlimited invitations, advanced sharing,
connected financial accounts, provider-supported refreshed values, enhanced
reminders/reviews/automation and Digital Financial Assets.

## Central entitlement architecture

Do not scatter `if paid` checks through pages. Build one canonical,
server-authoritative capability service that can represent, as appropriate:

- plan, subscription status and trial status;
- limits for properties, bank accounts, savings, pensions, digital accounts
  and invitations;
- Will, LPA, investments, business, Digital Financial Assets, financial
  connections and advanced sharing capabilities.

Exact field names remain an architecture decision. UI visibility, creation
limits and server authorization must resolve through the same capability
model. Entitlements do not replace RLS, role, IDV, estate or audit controls.

## Digital Financial Assets

Plan for a category supporting cryptoassets, NFTs/Digital Collectibles and
other digital investments. Legacy Fortress records ownership, reference,
evidence and value information; it is not cryptocurrency custody. Ordinary
asset forms must never collect or store wallet seed phrases or private keys.

## Premium UX

Premium functionality should generally remain visible with restrained locked
or greyed presentation and accessible status wording. Selecting it should
explain what it does, why it is Plus, available trial terms, monthly terms and
annual terms. Existing Free records remain visible after a limit is reached.

## Mobile strategy

The web platform remains the canonical application and source of truth. A
future iOS/Android layer may use the same services while adding native device
authentication, camera/document capture, push notifications, secure token
storage, native sharing/upload and invitation deep links. Native app
development is not part of the current phase.

## Security and product boundaries

One identity may own My Fortress and participate in multiple Linked Fortresses.
People I Trust is the owner-to-people direction; Linked Fortresses is the
recipient-to-owner direction. Relationship is not access, IDV is not legal
authority, and death evidence is not an automatic unlock. Existing RLS,
`account_access_grants`, role assignments, recipient binding, IDV assurance,
death verification, probate, quorum, append-only audit and estate
locking/versioning remain authoritative.

## Status discipline

Items in the roadmap are not implementation claims. Each future phase needs
an architecture decision, focused tests, security regressions, production
build validation and hosted acceptance before it is marked complete.
