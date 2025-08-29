import React from 'react'
export function Button({ variant='default', className='', ...props }){
  const cls = {
    default: 'btn btn-primary',
    outline: 'btn btn-outline',
    secondary: 'btn btn-secondary',
    destructive: 'btn btn-destructive',
    ghost: 'btn'
  }[variant] || 'btn btn-primary'
  return <button className={`${cls} ${className}`} {...props} />
}
export default Button
