import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import utc from "dayjs/plugin/utc";

const dayjs_ext = dayjs;

dayjs_ext.extend(utc);
dayjs_ext.extend(duration);

export { dayjs_ext as dayjs };