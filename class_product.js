/* exported Product */
// Product data model persisted in IndexedDB.
class Product {
    id;
    link;
    description_full;
    description_short;
    data_recommendation_id;
    data_recommendation_type;
    data_img_url;
    data_img_alt;
    data_asin;
    data_asin_is_parent;
    data_is_pre_release;
    data_is_featured;
    data_childs;
    data_estimated_tax;
    // NOTE: The field is not written any more. The prices are in
    // data_estimated_tax_prizes. It will be removed in a future release.
    data_estimated_tax_prize;
    // The prices of the product. It is empty for products without a known
    // price and has one entry for a product without variations.
    data_estimated_tax_prizes = [];
    data_tax_currency;
    data_contributors;
    data_feature_bullets;
    data_limited_quantity;
    data_catalogSize;
    real_prize;
    isFav = 0;
    isNew = 1;
    isNotified = false;
    ts_firstSeen = unixTimeStamp();
    ts_lastSeen = unixTimeStamp();
    // Incremented when a product is not observed during scans.
    notSeenCounter = 0;
    generated_short = false;
    gotFromDB = undefined;
    constructor(id) {
        this.id = id;
    }
}
