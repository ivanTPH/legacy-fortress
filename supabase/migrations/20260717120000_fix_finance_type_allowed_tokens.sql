-- Align finance category/type database validation with the canonical application registry.
-- The previous trigger allowed the normalized display phrase for Stocks and shares ISA
-- but missed the persisted canonical key stocks_shares_isa.

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
      'other_debt'
    ]);
  end if;

  return true;
end;
$$;
