/**
 * LWNTL Skeleton Card - Loading placeholder
 */

export function SkeletonCard() {
  return (
    <div
      className="neo-skeleton"
      style={{ height: '200px' }}
    >
      <div style={{ height: '6px', backgroundColor: '#ddd', borderBottom: '2.5px solid #111' }} />
      <div className="p-5">
        <div className="neo-skeleton" style={{ height: '20px', width: '70%', marginBottom: '12px', border: 'none' }} />
        <div className="neo-skeleton" style={{ height: '14px', width: '50%', marginBottom: '20px', border: 'none' }} />
        <div className="neo-skeleton" style={{ height: '24px', width: '100%', marginBottom: '8px', border: 'none' }} />
        <div className="neo-skeleton" style={{ height: '12px', width: '40%', border: 'none' }} />
      </div>
    </div>
  )
}