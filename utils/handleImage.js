const encodeFile = name => name.replace(/[^a-z0-9]+/gi, "-");

const getImageUrl = ({ product, size }) => {
	const fileName = encodeFile(product.name);
	const modified = `v=${+product.modified}`;
	const transform = size
		? `${product.expired !== Infinity ? "&" : "?"}tr=w-${size},h-${size}`
		: "";

	return product.expired !== Infinity
		? `project-inventory-user/${fileName}?${modified}${transform}`
		: `project-inventory-bucket/${fileName}.jpg${transform}`;
};

export { encodeFile, getImageUrl };
