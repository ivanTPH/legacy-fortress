# README snippet — Project operating rules

## Project operating rules
See:
- `docs/PROJECT_STRUCTURE.md`
- `docs/BUILD_AND_RELEASE.md`
- `docs/ATTACHMENT_AND_DOCUMENT_ARCHITECTURE.md`
- `docs/KNOWN_TECH_DEBT.md`

Working rules:
- prefer shared/canonical components over page-specific implementations
- do not reintroduce one-off attachment UIs where `AttachmentGallery` exists
- avoid new legacy patterns if a shared component or canonical data path already exists
- require explicit build and regression checks in every implementation report
