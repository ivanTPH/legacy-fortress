import Icon from "./Icon";

/** Version 3 logo tile. Screens adopt it in their own implementation phases. */
export default function BrandGlyph() {
  return (
    <span className="lf-brand-glyph" aria-hidden="true">
      <Icon name="apps" size={24} filled />
    </span>
  );
}
