const variants = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ai: "btn-ai",
  success: "btn-success",
  danger: "btn-danger"
};

function Button({
  children,
  type = "button",
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <button type={type} className={`btn ${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}

export default Button;
