import * as _dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

const dayjs = _dayjs.extend(utc);

export { dayjs };