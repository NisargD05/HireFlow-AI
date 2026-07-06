function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="page-kicker">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-copy">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export default PageHeader;
