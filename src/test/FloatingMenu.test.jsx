import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import FloatingMenu from '../components/ui/FloatingMenu.jsx'

const anchorRef=(top,bottom)=>({current:{getBoundingClientRect:()=>({top,bottom,left:30,right:230,width:200})}})
it('fits the reading-date menu above a low anchor when an explicit height is provided',()=>{
  render(<FloatingMenu anchorRef={anchorRef(innerHeight-100,innerHeight-60)} maxHeight={224} role="menu">Months</FloatingMenu>)
  expect(screen.getByRole('menu')).toHaveStyle({top:`${innerHeight-332}px`,maxHeight:'224px'})
})
it('keeps an explicit menu below when there is enough room',()=>{
  render(<FloatingMenu anchorRef={anchorRef(30,60)} maxHeight={224} role="menu">Months</FloatingMenu>)
  expect(screen.getByRole('menu')).toHaveStyle({top:'68px',maxHeight:'224px'})
})
it('preserves existing menu positioning without the opt-in height',()=>{
  render(<FloatingMenu anchorRef={anchorRef(innerHeight-100,innerHeight-60)} role="menu">Existing menu</FloatingMenu>)
  expect(screen.getByRole('menu')).toHaveStyle({top:`${innerHeight-52}px`})
  expect(screen.getByRole('menu').style.maxHeight).toBe('')
})
