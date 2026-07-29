export {
  MIN_ARTWORK_DPI,
  artworkReferenceSchema,
  customDimensionsSchema,
  customTextSchema,
  lineItemCustomizationSchema,
} from "./customization.js";
export {
  SITE_CONTENT_FIELDS,
  SITE_CONTENT_KEYS,
  resolveSiteContent,
  siteContentEntrySchema,
  siteContentKeySchema,
  siteContentUpdateSchema,
  validateSiteContentValue,
} from "./site-content.js";

export type {
  ArtworkReference,
  CustomDimensions,
  CustomText,
  LineItemCustomization,
} from "./customization.js";
export type {
  SiteContent,
  SiteContentEntry,
  SiteContentEntrySource,
  SiteContentField,
  SiteContentFieldType,
  SiteContentKey,
  SiteContentUpdate,
} from "./site-content.js";
