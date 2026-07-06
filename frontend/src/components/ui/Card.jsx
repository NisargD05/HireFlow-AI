function Card({ children, className = "" }) {
  return <section className={`surface ${className}`}>{children}</section>;
}

export default Card;
