odoo.define('bi_pos_barcode_lot_selection.productScreen', function(require) {
	"use strict";

	const Registries = require('point_of_sale.Registries');
	const ProductScreen = require('point_of_sale.ProductScreen'); 
	const NumberBuffer = require('point_of_sale.NumberBuffer');

	const BiProductScreen = (ProductScreen) =>
		class extends ProductScreen {
			constructor() {
				super(...arguments);
			}

			async _clickProduct(event) {
				const product = event.detail;
				if (['serial', 'lot'].includes(product.tracking) && (this.env.pos.picking_type.use_create_lots || this.env.pos.picking_type.use_existing_lots)) {
					if (!this.currentOrder) {
						this.env.pos.add_new_order();
					}
					let price_extra = 0.0;
					let draftPackLotLines, weight, description, packLotLinesToEdit;

					if (this.env.pos.config.product_configurator && _.some(product.attribute_line_ids, (id) => id in this.env.pos.attributes_by_ptal_id)) {
						let attributes = _.map(product.attribute_line_ids, (id) => this.env.pos.attributes_by_ptal_id[id])
										  .filter((attr) => attr !== undefined);
						let { confirmed, payload } = await this.showPopup('ProductConfiguratorPopup', {
							product: product,
							attributes: attributes,
						});

						if (confirmed) {
							description = payload.selected_attributes.join(', ');
							price_extra += payload.price_extra;
						} else {
							return;
						}
					}

					// Gather lot information if required.
					if (['serial', 'lot'].includes(product.tracking) && (this.env.pos.picking_type.use_create_lots || this.env.pos.picking_type.use_existing_lots)) {
						const isAllowOnlyOneLot = product.isAllowOnlyOneLot();
						if (isAllowOnlyOneLot) {
							packLotLinesToEdit = [];
						} else {
							const orderline = this.currentOrder
								.get_orderlines()
								.filter(line => !line.get_discount())
								.find(line => line.product.id === product.id);
							if (orderline) {
								packLotLinesToEdit = orderline.getPackLotLinesToEdit();
							} else {
								packLotLinesToEdit = [];
							}
						}
						let barcodes = this.env.pos.db.get_lot_barcode_by_prod_id(product.id);
						const { confirmed, payload } = await this.showPopup('EditListPopup', {
							title: this.env._t('Lot/Serial Number(s) Required'),
							isSingleItem: isAllowOnlyOneLot,
							array: packLotLinesToEdit,
							product : product,
							barcodes : barcodes,
						});
						if (confirmed) {
							// Segregate the old and new packlot lines
							const modifiedPackLotLines = Object.fromEntries(
								payload.newArray.filter(item => item.id).map(item => [item.id, item.text])
							);
							const newPackLotLines = payload.newArray
								.filter(item => !item.id)
								.map(item => ({ lot_name: item.text }));

							draftPackLotLines = { modifiedPackLotLines, newPackLotLines };
						} else {
							// We don't proceed on adding product.
							return;
						}
					}

					// Take the weight if necessary.
					if (product.to_weight && this.env.pos.config.iface_electronic_scale) {
						// Show the ScaleScreen to weigh the product.
						if (this.isScaleAvailable) {
							const { confirmed, payload } = await this.showTempScreen('ScaleScreen', {
								product,
							});
							if (confirmed) {
								weight = payload.weight;
							} else {
								// do not add the product;
								return;
							}
						} else {
							await this._onScaleNotAvailable();
						}
					}
					// Add the product after having the extra information.
					this.currentOrder.add_product(product, {
						draftPackLotLines,
						description: description,
						price_extra: price_extra,
						quantity: weight,
					});

					NumberBuffer.reset();
				}
				else{
					super._clickProduct(event);
				}
			}
			
			async _onClickPay() {
				let self = this;
				let order = this.env.pos.get_order();
				let lines = order.get_orderlines();
				let pos_config = self.env.pos.config; 
				let call_super = true;
				
				let has_valid_product_lot = _.every(lines, function(line){
					return line.has_valid_product_lot();
				});
				if(!has_valid_product_lot){
					call_super = false;  
					self.showPopup('ErrorPopup', {
						title: self.env._t('Empty Serial/Lot Number'),
						body: self.env._t('One or more product(s) required serial/lot number..'),
					});
					return
				}

				let lot_qty = {};
				$.each(lines, function( i, line ){
					let prd = line.product;
					if (prd.type == 'product' && 
						prd.tracking == 'lot' && line.lots_barcode.length > 0){
						let lot_brcd = line.lots_barcode[0];
						let lot_name =lot_brcd.lot_name;
						let lt_qty = lot_brcd.product_qty;
						if(pos_config.show_stock_location == 'specific'){
							lt_qty = lot_brcd.loc_qty
						}
						if(lot_name in lot_qty){
							let old_qty = lot_qty[lot_name][1];
							lot_qty[lot_name] = [lt_qty,line.quantity+old_qty]
						}else{
							lot_qty[lot_name] = [lt_qty,line.quantity]
						}
						if(lt_qty < line.quantity){
							call_super = false;  
							self.showPopup('ErrorPopup', {
								title: self.env._t('Invalid Lot Quantity'),
								body: self.env._t('Ordered qty of One or more product(s) is more than available qty.'),
							});
						}
					}
				});

				$.each(lot_qty, function( i, lq ){
					if (lq[1] > lq[0]){
						call_super = false;  
						self.showPopup('ErrorPopup', {
							title: self.env._t('Invalid Lot Quantity'),
							body: self.env._t('Ordered qty of One or more product(s) is more than available qty.'),
						});
					}
				});

				if(call_super){
					super._onClickPay();
				}
			}
		};

	Registries.Component.extend(ProductScreen, BiProductScreen);

	return ProductScreen;

});
