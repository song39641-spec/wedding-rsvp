import React, { createContext, useContext, useId } from 'react'
const Ctx = createContext({ name:'', value:'', onValueChange:()=>{} })
export function RadioGroup({ value, onValueChange, children, className='' }){
  const name = useId()
  return <div className={className}><Ctx.Provider value={{name, value, onValueChange}}>{children}</Ctx.Provider></div>
}
export function RadioGroupItem({ id, value }){
  const ctx = useContext(Ctx)
  return <input type="radio" id={id} name={ctx.name} value={value} checked={ctx.value===value} onChange={()=>ctx.onValueChange(value)} />
}
export default RadioGroup
