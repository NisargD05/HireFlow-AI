function FormField({
  label,
  name,
  value,
  onChange,
  required = false,
  type = "text",
  textarea = false,
  placeholder = ""
}) {
  const inputClass =
    "field-control";

  return (
    <label className="block">
      <span className="field-label">
        {label}
        {required ? (
          <span className="ml-1 text-red-500">*</span>
        ) : (
          <span className="ml-2 text-xs font-normal text-slate-400">Optional</span>
        )}
      </span>
      {textarea ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows="4"
          className={inputClass}
          required={required}
        />
      ) : (
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={inputClass}
          required={required}
        />
      )}
    </label>
  );
}

export default FormField;
