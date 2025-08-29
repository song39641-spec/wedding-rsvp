import React, { createContext, useContext, useState } from 'react'
const TabsCtx = createContext(null)
export function Tabs({ defaultValue, children, className='' }){
  const [value, setValue] = useState(defaultValue)
  return <div className={className}><TabsCtx.Provider value={{value, setValue}}>{children}</TabsCtx.Provider></div>
}
export function TabsList({ children, className='', style }){ return <div className={`tabs-list ${className}`} style={style}>{children}</div> }
export function TabsTrigger({ value, children, className='' }){
  const { value: v, setValue } = useContext(TabsCtx)
  const active = v === value
  return <button className={`tabs-trigger ${active?'tabs-trigger-active':''} ${className}`} onClick={()=>setValue(value)}>{children}</button>
}
export function TabsContent({ value, children }){
  const { value: v } = useContext(TabsCtx)
  if (v !== value) return null
  return <div className="mt-4">{children}</div>
}
export default Tabs
