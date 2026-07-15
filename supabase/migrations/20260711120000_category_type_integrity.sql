-- Enforce finance category/type compatibility for legacy records writes.
-- Canonical assets should migrate to a lookup-table/FK model when all finance
-- categories are on the assets path; this trigger protects the remaining
-- legacy records path used by pensions, investments, insurance and debts.

create or replace function public.lf_normalize_category_type_token(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(lower(coalesce(value, '')), '&', ' and ', 'g'),
      '[/_\s]+',
      ' ',
      'g'
    ),
    '[^a-z0-9]+',
    '_',
    'g'
  );
$$;

create or replace function public.lf_finance_allowed_type(category_key text, type_value text)
returns boolean
language plpgsql
immutable
as $$
declare
  normalized_category text := public.lf_normalize_category_type_token(category_key);
  normalized_type text := public.lf_normalize_category_type_token(type_value);
begin
  if normalized_category = 'bank' or normalized_category = 'bank_accounts' or normalized_category = 'bank_account' then
    return normalized_type = any(array[
      'current_account',
      'current',
      'savings_account',
      'savings',
      'cash_deposit',
      'cash',
      'deposit',
      'fixed_deposit',
      'fixed_deposit_term_deposit',
      'isa_cash',
      'isa',
      'cash_isa',
      'joint_account',
      'joint',
      'business_account',
      'business',
      'other_bank_account'
    ]);
  end if;

  if normalized_category = 'investments' then
    return normalized_type = any(array[
      'share_portfolio',
      'shares',
      'stocks_and_shares_isa',
      'investment_fund',
      'fund',
      'mutual_fund',
      'unit_trust',
      'investment_trust',
      'investment_bond',
      'bond',
      'brokerage_account',
      'brokerage_platform_account',
      'platform_account',
      'managed_portfolio',
      'premium_bonds',
      'private_equity',
      'crypto_digital_investment',
      'crypto_investment',
      'other_investment'
    ]);
  end if;

  if normalized_category = 'pensions' or normalized_category = 'pension' then
    return normalized_type = any(array[
      'workplace_pension',
      'workplace',
      'personal_pension',
      'personal',
      'pension',
      'sipp',
      'self_invested_personal_pension',
      'defined_benefit',
      'final_salary',
      'final_salary_defined_benefit',
      'defined_contribution',
      'stakeholder_pension',
      'stakeholder',
      'state_pension',
      'public_sector_pension',
      'other_pension'
    ]);
  end if;

  if normalized_category = 'insurance' then
    return normalized_type = any(array[
      'life_insurance',
      'life',
      'life_cover',
      'critical_illness',
      'critical_illness_cover',
      'income_protection',
      'health_insurance',
      'health',
      'home_insurance',
      'home',
      'vehicle_insurance',
      'vehicle',
      'car',
      'car_insurance',
      'other_insurance'
    ]);
  end if;

  if normalized_category = 'debts' or normalized_category = 'debt' or normalized_category = 'loans_liabilities' then
    return normalized_type = any(array[
      'credit_card',
      'personal_loan',
      'loan',
      'mortgage',
      'overdraft',
      'business_debt',
      'other_debt'
    ]);
  end if;

  return true;
end;
$$;

create or replace function public.lf_validate_finance_record_category_type()
returns trigger
language plpgsql
as $$
declare
  type_value text;
begin
  if new.section_key is distinct from 'finances' then
    return new;
  end if;

  if new.category_key = 'investments' then
    type_value := coalesce(new.metadata->>'investment_type', '');
  elsif new.category_key = 'pensions' then
    type_value := coalesce(new.metadata->>'pension_type', '');
  elsif new.category_key = 'insurance' then
    type_value := coalesce(new.metadata->>'policy_type', '');
  elsif new.category_key = 'debts' then
    type_value := coalesce(new.metadata->>'debt_type', '');
  else
    return new;
  end if;

  if btrim(type_value) = '' then
    raise exception 'CATEGORY_TYPE_MISMATCH: finance record type is required for %', new.category_key
      using errcode = '23514';
  end if;

  if not public.lf_finance_allowed_type(new.category_key, type_value) then
    raise exception 'CATEGORY_TYPE_MISMATCH: % is not valid for %', type_value, new.category_key
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists records_finance_category_type_integrity on public.records;
create trigger records_finance_category_type_integrity
before insert or update of section_key, category_key, metadata
on public.records
for each row
execute function public.lf_validate_finance_record_category_type();

create or replace function public.lf_validate_finance_asset_category_type()
returns trigger
language plpgsql
as $$
declare
  type_value text;
begin
  if new.section_key is distinct from 'finances' then
    return new;
  end if;

  if new.category_key = 'bank' then
    type_value := coalesce(new.metadata_json->>'account_type', '');
  elsif new.category_key = 'investments' then
    type_value := coalesce(new.metadata_json->>'investment_type', '');
  elsif new.category_key = 'pensions' then
    type_value := coalesce(new.metadata_json->>'pension_type', '');
  elsif new.category_key = 'insurance' then
    type_value := coalesce(new.metadata_json->>'policy_type', '');
  elsif new.category_key = 'debts' then
    type_value := coalesce(new.metadata_json->>'debt_type', '');
  else
    return new;
  end if;

  if btrim(type_value) = '' then
    raise exception 'CATEGORY_TYPE_MISMATCH: finance asset type is required for %', new.category_key
      using errcode = '23514';
  end if;

  if not public.lf_finance_allowed_type(new.category_key, type_value) then
    raise exception 'CATEGORY_TYPE_MISMATCH: % is not valid for %', type_value, new.category_key
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists assets_finance_category_type_integrity on public.assets;
create trigger assets_finance_category_type_integrity
before insert or update of section_key, category_key, metadata_json
on public.assets
for each row
execute function public.lf_validate_finance_asset_category_type();
