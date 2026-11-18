// One-line error summary for per-field forms (A11-F6, A11-F5 follow-up). Shown only while the form has
// field errors; an alert that becomes visible is announced once. `hidden` keeps it out of the layout (and
// out of Tailwind space-y spacing) while there are no errors. Focus still moves to the first invalid field
// (lib/form-a11y.ts useFocusFirstInvalid).
export default function FormErrorSummary({ show, className = '' }: { show: boolean; className?: string }) {
  return (
    <p role="alert" hidden={!show} className={`text-red-700 text-sm ${className}`.trim()}>
      Please correct the highlighted fields below.
    </p>
  )
}
