/**
 * Multi-line text — owned by A.
 *
 * FormField already renders a textarea; this is the named entry point the
 * locked signature promises, not a second implementation. rows, maxLength and
 * everything else flow through FormField's own prop spread.
 */

import { forwardRef } from 'react';

import { FormField } from './FormField';

export const FormTextarea = forwardRef(function FormTextarea(props, ref) {
  return <FormField ref={ref} type="textarea" {...props} />;
});
