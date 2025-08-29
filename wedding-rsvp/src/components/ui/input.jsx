import React from 'react'
export function Input(props){ return <input {...props} className={`input ${props.className||''}`} /> }
export default Input
