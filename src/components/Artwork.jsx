export function Artwork({ variant = 'portrait', className = '' }) {
  return (
    <div className={`artwork artwork-${variant} ${className}`} aria-hidden="true">
      <span className="art-orb" /><span className="art-plane" /><span className="art-line" />
    </div>
  )
}
