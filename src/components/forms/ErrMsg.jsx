import { B } from "../../theme/tokens";

export function ErrMsg({ id, msg }) {
  return msg
    ? <div id={id} role="alert" style={{ fontSize: 11, color: B.red, marginTop: 4 }}>{msg}</div>
    : null;
}
