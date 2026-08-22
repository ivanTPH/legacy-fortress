-- Phase 3 correction: estate-administration document reads must honor claimant
-- suspension/revocation. Uploader provenance does not by itself authorize
-- future reads or downloads.

DROP POLICY IF EXISTS estate_admin_documents_estate_claim_select ON public.estate_administration_documents;
CREATE POLICY estate_admin_documents_estate_claim_select ON public.estate_administration_documents
  FOR SELECT USING (
    auth.uid() = owner_user_id
    OR EXISTS (
      SELECT 1
      FROM public.estate_access_claims claim
      WHERE claim.id = estate_claim_id
        AND claim.claimant_user_id = auth.uid()
        AND claim.status = 'active'
        AND public.lf_identity_assurance_level(claim.claimant_user_id) >= claim.required_identity_level
        AND COALESCE(claim.permissions -> 'estate_document_ids', '[]'::jsonb) ? id::text
    )
  );
