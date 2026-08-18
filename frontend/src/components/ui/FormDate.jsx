/**
 * Date input — owned by A.
 *
 * FormField already renders type="date"; this is the named entry point the
 * locked signature promises, not a second date input. min and max flow through
 * FormField's own prop spread onto the element, so nothing here handles them.
 *
 * The value is a "YYYY-MM-DD" string, which is both what <input type="date">
 * reads and writes and how date-only fields are stored (docs/entities.md).
 * Never hand this a Date object — formatting is lib/format.js's job, and a Date
 * here silently renders an empty field.
 */

import { forwardRef } from 'react';

import { FormField } from './FormField';

export const FormDate = forwardRef(function FormDate(props, ref) {
  return <FormField ref={ref} type="date" {...props} />;
});
