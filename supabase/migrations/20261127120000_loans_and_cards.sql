-- Loans & mortgages and Cards (owner approval required: Ivan, 27 Nov 2026).
--
-- 1. Debts becomes "Loans & mortgages" in the app. The database learns four more loan types:
--    car finance (HP/PCP), buy now pay later, student loan, and money owed to family or friends.
--    Every existing type stays allowed, including credit_card, so no saved record can become invalid.
--
-- 2. Credit cards now live in Finances > Cards. Credit cards saved as debts move there:
--    the record keeps its id, owner, title, documents, people and history; its category changes from
--    'debts' to 'cards' and its details gain the card fields the Cards page reads. The old debt fields
--    are kept, so nothing is lost. Only records whose debt type is a credit card are touched.
--
-- No table, column, policy or permission changes. Row-level security is unchanged.

-- 1. Allowed finance types.
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
      'cash_deposit_account',
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
      'stocks_shares_isa',
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
      'other_debt',
      -- Loans & mortgages, 27 Nov 2026
      'car_finance',
      'buy_now_pay_later',
      'student_loan',
      'family_loan'
    ]);
  end if;

  return true;
end;
$$;


-- 2. Move credit-card debts into Cards.
update public.records
set
  category_key = 'cards',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'card_type', 'credit_card',
    'card_provider', coalesce(nullif(metadata->>'creditor_name', ''), nullif(provider_name, ''), nullif(title, '')),
    'card_balance', nullif(metadata->>'outstanding_balance', ''),
    'moved_from_debts', '2026-11-27'
  )),
  updated_at = now()
where section_key = 'finances'
  and category_key in ('debts', 'debt', 'loans-liabilities')
  and public.lf_normalize_category_type_token(metadata->>'debt_type') = 'credit_card';
