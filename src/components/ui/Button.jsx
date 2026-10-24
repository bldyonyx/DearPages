function Button({
  children,
  variant = 'primary',
  size = 'default',
  className = '',
  ...props
}) {
    const variants = {
    primary:
        'bg-darkwood text-cream enabled:hover:bg-walnut',

    ghost:
        'bg-transparent text-walnut/65 enabled:hover:bg-mintcream/60 enabled:hover:text-darkwood',
    secondary:
        'bg-cream text-darkwood border border-walnut/20 enabled:hover:border-walnut/40',
    }

  return (
    <button
    className={`
        rounded-lg
        ${size === 'icon' ? 'size-11 shrink-0 p-0' : size === 'compact' ? 'min-h-11 px-2 py-1' : 'px-4 py-2'}
        font-ui
        text-sm
        transition-colors duration-200 ease-out
        enabled:active:brightness-95
        cursor-pointer
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-olive/35
        disabled:cursor-not-allowed
        disabled:opacity-60
        ${variants[variant]}
        ${className}
    `}
    {...props}
    >
    {children}
    </button>
  )
}

export default Button
