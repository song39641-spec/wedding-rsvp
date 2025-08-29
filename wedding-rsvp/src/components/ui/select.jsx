import React from 'react'
export function Select({ value, onValueChange, disabled, children }){
  // We render SelectContent directly (native select) and ignore Trigger.
  const content = React.Children.toArray(children).find(
    (c) => React.isValidElement(c) && c.type && c.type.displayName === 'SelectContent'
  )
  return React.cloneElement(content || <div />, { value, onValueChange, disabled })
}
export function SelectTrigger({ children, className='' }){ return <div className={className} style={{display:'none'}}>{children}</div> }
export function SelectValue({ placeholder }){ return null }
export function SelectContent({ children, value, onValueChange, disabled }){
  const items = React.Children.toArray(children).filter(React.isValidElement)
  return (
    <select className="select" value={value} onChange={(e)=>onValueChange(e.target.value)} disabled={disabled}>
      {items}
    </select>
  )
}
SelectContent.displayName = 'SelectContent'
export function SelectItem({ value, children }){
  return <option value={value}>{children}</option>
}
export default Select
