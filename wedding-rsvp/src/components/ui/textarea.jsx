import React from 'react'
export function Textarea(props){ return <textarea {...props} className={`textarea ${props.className||''}`} /> }
export default Textarea
