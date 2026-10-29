export const IMAGES: Record<string, any> = {
  "banner-1": require("../assets/dg/banner-12.jpg"),
  "banner-2": require("../assets/dg/banner-11.jpg"),
  "heritage-necklace": require("../assets/dg/heritage-necklace-24k.jpg"),
  "minimalist-bangle": require("../assets/dg/minimalist-bangle.jpg"),
  rings: require("../assets/dg/categories/rings.jpg"),
  bangles: require("../assets/dg/categories/bangles.jpg"),
  necklace: require("../assets/dg/categories/necklace.jpg"),
  chain: require("../assets/dg/categories/chain.jpg"),
  kada: require("../assets/dg/categories/kada.jpg"),
  "pendant-set": require("../assets/dg/categories/pendant-set.jpg"),
  watch: require("../assets/dg/categories/watch.jpg"),
  tanmaniya: require("../assets/dg/categories/tanmaniya.jpg"),
};

export const CATEGORIES = [
  { id: "rings", label: "Rings", image: "rings", icon: "CircleDot" },
  { id: "bangles", label: "Bangles", image: "bangles", icon: "Disc3" },
  { id: "necklaces", label: "Necklaces", image: "necklace", icon: "Gem" },
  { id: "chains", label: "Chains", image: "chain", icon: "Link2" },
  { id: "kadas", label: "Kadas", image: "kada", icon: "Crown" },
  { id: "pendant-sets", label: "Pendant Sets", image: "pendant-set", icon: "Diamond" },
  { id: "watches", label: "Watches", image: "watch", icon: "Watch" },
];

export const BANNERS = [
  {
    id: "b1",
    image: "banner-1",
    eyebrow: "LBMA CERTIFIED",
    title: "24K 99.9% Pure LBMA Certified Gold",
    subtitle: "Start saving with just ₹10",
  },
  {
    id: "b2",
    image: "banner-2",
    eyebrow: "INSURED BY BRINK'S",
    title: "Doorstep Vault Delivery",
    subtitle: "Insured delivery of gold coins & bars by BRINK'S",
  },
];
