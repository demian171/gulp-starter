"use strict";

import gulp from 'gulp';

const { task, parallel, watch, series, lastRun, src, dest } = gulp;

import babel from 'gulp-babel';
import csscomb from 'gulp-csscomb';  //Сортирует css свойства
import csso from 'gulp-csso';  //Оптимизация css
import dependents from 'gulp-dependents'; //Проверяет зависимости в файле
import fileInclude from 'gulp-file-include'; //Подключение html секций
import notify from 'gulp-notify'; //Подключение уведомления об ошибках в файле
import plumber from 'gulp-plumber'; //Подключение уведомления об ошибках в файле
import gulpPostcss from 'gulp-postcss'; //Пост обработка файлов css
import postcss from 'postcss'; //Пост обработка файлов css
import rename from 'gulp-rename'; //Переименование файла
import gulpSass from 'gulp-sass'; //Обработка sass/scss файлов, и перекомпиляция в css
import dartSass from 'sass'; //Обработка sass/scss файлов
const sass = gulpSass(dartSass);
import fiber from "fibers"; //Ускорение работы плагина gulp-sass
import cssnano from "cssnano"; //Минификация стилей
import flexFix from 'postcss-flexbugs-fixes';
import sassInheritance from "gulp-sass-inheritance"; //Проверяет зависимости в файлах scss
import sourcemaps from 'gulp-sourcemaps'; //Создает карту css свойст
import autoprefixer from 'autoprefixer'; //Добавление поефикса(флага) для свойст если нужно
import browserSync from 'browser-sync'; //Локальный сервер что бы сразу видить свои изменения
import gulpif from "gulp-if";
import uglifyES from "gulp-uglify";

import size from 'gulp-size';
import imagemin from 'gulp-imagemin';
import imageminOptipng from 'imagemin-optipng';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminWebp from 'imagemin-webp';
import webp from 'gulp-webp';
import imageminSvgo from 'imagemin-svgo';

import arg from 'yargs';
const argv = arg.array('sprites').argv;
import svgSprite from 'gulp-svg-sprite';
import replace from 'gulp-replace';

import debug from 'gulp-debug';
import chalk from 'chalk';
import fs from "fs";
import log from "fancy-log";

import { paths } from './global.paths.config.js';
import { pngOptions } from './gulp/configs/pngOptions.js';
import { mozjpegOptions } from './gulp/configs/mozjpegOptions.js';
import { webpOptions } from './gulp/configs/webpOptions.js';
import { svgOptions } from './gulp/configs/svgOptions.js';

// Include paths project
import { sprites_src } from './gulp/sprite/sprites_list.js';

let sprite = [];
let init_cwd = '';
let scss_path = '';

const names = Object.keys(sprites_src);
names.forEach(function(name) {
	sprite.push(name);
});

const production = !!arg.production;

task('copy', () => {
	return src([paths.src_folder + '/**/*.*'], {
		since: lastRun('copy')
	})
		.pipe(dest(paths.dist_folder))
});

task('html', () => {
	return src([paths.src_folder + '/**/*.html'], {
		since: lastRun('html')
	})
		.pipe(fileInclude())
		.pipe(dest(paths.dist_folder))
		.pipe(browserSync.stream());
});

task('html:copy', () => {
	return src([paths.src_folder + '/**/*.html'], {
		since: lastRun('html')
	})
		.pipe(dest(paths.dist_folder))
		.pipe(browserSync.stream());
});

task('sass', () => {
	// Post-CSS plugins array
	const processors = [
		// auto fix some flex-box issues
		flexFix(),
		// auto adds vendor prefixes
		autoprefixer({
			grid: true,
			overrideBrowserslist: [
				"last 2 version",
				"not dead",
				"not ie <= 11"
			]
		})
	];

	return src([paths.src_folder + '/styles/**/*.scss'
	], { since: lastRun('sass') })
		.pipe(
			plumber({
				errorHandler: notify.onError(err => ({
					title: "sass",
					message: err.message
				}))
			})
		) // Window notification
		.pipe(sourcemaps.init())
		.pipe(dependents())
		.pipe(sassInheritance({ dir: paths.src_folder + '/styles/' }) )
		.pipe(sass.sync({
				fiber: fiber,
				sourceComments: false,
				outputStyle: "expanded"
			}).on('error', sass.logError))
		.pipe(debug({title: chalk.cyan.bold(`-> Start style minification`)}))
		.pipe(gulpPostcss(processors))
		.pipe(csscomb()) // Format CSS coding style with
		.pipe(csso({
			restructure: true,
			sourceMap: true,
			debug: false
		}))
		.pipe(gulpPostcss([cssnano()]))
		.pipe(rename({ suffix: ".min" }))
		.pipe(sourcemaps.write('.'))
		.pipe(dest(paths.dist_folder + '/css/'))
		.pipe(browserSync.stream());
});

task('image', () => {
	return src(paths.src_folder + '/images/**/*.+(png|jpg|jpeg|svg)', { since: lastRun('image') })
		.pipe(
			plumber({
				errorHandler: notify.onError(error => ({
					title: 'Image',
					message: error.message /*+ '<%= file.relative %>'*/
				}))
			})
		) // Window notification
		.pipe(gulpif(production,imagemin([
			imageminOptipng({ pngOptions }), // Оптимизация png // Работа с цветом
			imageminMozjpeg({ mozjpegOptions }), // Оптимизация jpg
			imageminSvgo({ plugins: svgOptions }) //Оптимизация svg
		])))
		.pipe(dest(paths.dist_folder + '/images/'))
		.pipe(size({ title: '[images]' })) //Размер картинок
		.pipe(browserSync.stream());
});

task('image:webp', () => {
	return src(paths.src_folder + '/images/**/*.+(png|jpg|jpeg)', { since: lastRun('image:webp') })
		.pipe(
			plumber({
				errorHandler: notify.onError(error => ({
					title: 'image:webp',
					message: error.message /*+ '<%= file.relative %>'*/
				}))
			})
		) // Window notification
		.pipe(gulpif(production, webp({ webpOptions }))) // Оптимизация webp & конвертация jpg/png to webp
		.pipe(dest(paths.dist_folder + '/images/'))
		.pipe(size({ title: '[images]' })) //Размер картинок
		.pipe(browserSync.stream());
});

function runSprite(name, cb) {
	if (typeof name === 'function') {
		cb = name;
		name = argv.name;
	}

	//we are using sprites list
	if (name in sprites_src) {
		init_cwd = sprites_src[name].sprite_src;
		scss_path = sprites_src[name].scss;

		if (init_cwd && scss_path) {
			init_cwd = paths.src_folder + init_cwd;
		} else {
			throw new Error('Error in sprite_src or scss properties of sprites_list.json');
		}
	} else if (name) {
		throw new Error('No such key "' + name + '" in sprites_list.json');
	}

	src(init_cwd + '/**/*.svg', { since: lastRun('sprites') })
		.pipe(
			svgSprite({
				log: 'info',
				shape: {
					id: {
						separator: '-',
						generator: 'svg-%s'
					},
					transform: [
						{
							custom: function(shape, spriter, callback) {
								var old = shape.setNamespace;
								shape.setNamespace = function(ns) {
									return old.call(shape, name + ns);
								};
								callback(null);
							}
						}
					]
				},
				svg: {
					transform: [
						function(svg) {
							var defsRegex = /<defs[^>]*>.+?<\/defs>/g;
							var defs = svg.match(defsRegex);

							if (defs) {
								svg = svg.replace(defsRegex, '');
								svg = svg.replace('<symbol ', defs.join('') + '<symbol ');
							}

							return svg;
						}
					]
				},
				mode: {
					symbol: {
						dest: '',
						sprite: init_cwd + '/../sprite.svg',
						inline: true,
						render: {
							scss: {
								template: 'gulp/sprite/tmpl_scss.mustache',
								dest: paths.src_folder + '/styles/sprites/' + scss_path
							}
						}
					}
				},
				variables: {
					baseFz: 20,
					prefixStatic: 'svg-'
				}
			})
		)
		.pipe(dest('.'))
		.on('finish', cb);
}

task('sprite', function(cb) {
	let count = 0;
	names.forEach(function(name) {
		runSprite(name, function() {
			++count === names.length && cb();
		});
	});
});

task('svg_inline', () => {
	return src(`${ paths.src_folder }/index.html`)
		.pipe(replace(/<div id="svg_inline">(?:(?!<\/div>)[^])*<\/div>/g, () => {    // Поиск div с id svg_inline для того что бы вставить содержимое файла ./images/sprite_src/sprite.svg
			const svgInline = fs.readFileSync(`${ paths.src_folder + sprites_src.sprite.sprite_inline }/sprite.svg`, 'utf8');  // Открываем файл
			return '<div id="svg_inline">\n' + svgInline + '\n</div>';          // Вставляем в div с id svg_inline содержимое файла ./images/sprite_src/sprite.svg
		}))
		.on('error', err => {
			log.error(err.message);
		})
		.pipe(dest(paths.dist_folder));
});

task('sprites', series('sprite', 'svg_inline'));

task('js', () => {
	return src([ paths.src_folder + '/scripts/**/*.js' ], { since: lastRun('js') })
		.pipe(plumber({
			errorHandler: notify.onError(err => ({
				title: "javascript",
				message: err.message
			}))
		}) ) // Window notification
		.pipe(sourcemaps.init())
		.pipe(babel({
			presets: [ '@babel/env' ]
		}))
		.pipe(gulpif(production,uglifyES()))
		.pipe(sourcemaps.write('.'))
		.pipe(dest(paths.dist_folder + '/js/'))
		.pipe(browserSync.stream());
});

task('images', series('image', 'image:webp'));

task('pages', series('svg_inline', 'html:copy'));

task('build', series('html', 'sass', 'images'));

task('dev', series('pages', 'sass', 'images','sprites'));

task('serve', () => {
	return browserSync.init({
		server: {
			baseDir: [ 'dist' ]
		},
		port: 9000,
		open: true
	});
});

task('watch', () => {
	const watchImages = paths.src_folder + '/images/**/*.+(png|jpg|jpeg|svg)';
	const watchSprites = paths.src_folder + '/images/sprites/**/*.svg';
	const watchHTML = paths.src_folder + '/**/*.html';
	const watchsStyles = paths.src_folder + '/styles/**/*.scss';
	const watchsScripts = paths.src_folder + '/scripts/**/*.js';

	watch(`./src/styles/**/*.scss`, series('sass')).on('change', browserSync.reload);
	watch(`./src/scripts/**/*.js`, series('js')).on('change', browserSync.reload);
	watch(`./src/images/**/*.+(png|jpg|jpeg|svg)`, series('images')).on('change', browserSync.reload);
	watch(`./src/**/*.html`, series('pages')).on('change', browserSync.reload);
	watch(`./src/images/sprites/**/*.svg`, series('sprites')).on('change', browserSync.reload);
});

task('default', series('dev', parallel('serve', 'watch')));
