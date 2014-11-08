/*
 * This is a mock store for GameInfo that is used when we're running in browser.
 */

'use strict'

var _ = require('lodash');
var Reflux = require('reflux');

module.exports = Reflux.createStore({
	init: function(){
		_.extend(this, {
			games: {
				"Zero-K v1.2.9.9": {
					bots: {
						'CAI': { desc: 'AI that plays regular Zero-K' },
						'Chicken: Very Easy': { desc: 'For PvE in PvP games' },
						'Chicken: Easy': { desc: 'Ice cold' },
						'Chicken: Normal': { desc: 'Lukewarm' },
						'Chicken: Hard': { desc: 'Will burn your ass' },
						'Chicken: Suicidal': { desc: 'Flaming hell!' },
						'Chicken: Custom' : { desc: 'A chicken experience customizable using modoptions' },
						'Null AI': { desc: 'Empty AI for testing purposes' },
					},
					local: true,
				},
				"Evolution RTS - v8.04": {
					bots: {
						'Shard': { desc: 'Shard by AF' },
						'Survival Spawner: Very Easy': { desc: 'Beginner Games' },
						'Survival Spawner: Easy': { desc: 'Normal Games' },
						'Survival Spawner: Normal': { desc: 'Average Games' },
						'Survival Spawner: Hard': { desc: 'Large Games' },
						'Survival Spawner: Very Hard': { desc: 'Hardcore Games' },
						'Null AI': { desc: 'Empty AI for testing purposes' },
					},
					local: true,
				},
			},
			maps: {
				"SuperSpeedMetal": {
					minimap: 'http://api.springfiles.com/metadata/8f566ae85e32822ab0daf9fc840f5dd3.jpg',
				},
				"Titan-v2": {
					minimap: 'http://api.springfiles.com/metadata/73ba7491b1b477d83b50c34753db65fc.jpg',
					local: true,
				},
				"OnyxCauldron1.6": {
					minimap: 'http://api.springfiles.com/metadata/ceed5cc8dead21882324db17b44ac2f4.jpg',
					local: true,
				},
				"Comet Catcher Redux v2": {
					minimap: 'http://api.springfiles.com/metadata/efe211c518f2eabafa38117d7931de7d.jpg',
					local: true,
				},
			},
			engines: {
				"91.0": null,
				"96.0": null,
				"97.0.1-120-g3f35bbe": null,
				"97.0.1-135-gf161bef": null,
				"97.0.1-170-g313caff": null,
				"97.0.1-374-g21b3b68": null,
				"98.0": null,
			},
		});
	},
	getDefaultData: function(){
		return {
			games: this.games,
			maps: this.maps,
			engines: _.keys(this.engines),
			currentOperation: null,
		};
	},
});
