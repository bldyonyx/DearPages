function Select({
  label,
  id,
  children,
  className = '',
  ...props
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="font-ui text-sm text-darkwood"
        >
          {label}
        </label>
      )}

      <select
        id={id}
        className={`
          rounded-lg
          border border-walnut/20
          bg-cream
          px-4 py-2
          font-ui text-sm text-darkwood
          outline-none
          transition-colors duration-200 ease-out
          cursor-pointer
          focus:border-walnut/60
          focus-visible:ring-2
          focus-visible:ring-lime/40
          disabled:cursor-not-allowed
          disabled:opacity-60
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

export default Select
