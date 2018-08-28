'use strict';

const urlApi = 'https://neto-api.herokuapp.com';

const wrapCommentsCanvas = document.createElement('div');
const canvas = document.createElement('canvas');

let connection;
let dataGetParse; 
let showComments = {};
let currColor;

const currentImage = document.querySelector('.current-image');
const loader = document.querySelector('.image-loader');
const wrapApp = document.querySelector('.app');

let movedPiece = null;
let minY, minX, maxX, maxY;
let shiftX = 0;
let shiftY = 0;

let url = new URL(`${window.location.href}`);
let paramId = url.searchParams.get('id'); 

document.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', throttle(drag));
document.addEventListener('mouseup', drop);

setGlobalVar('error');
setGlobalVar('menu');
setGlobalVar('burger');

// ----------режим "Публикация"------------------------------------------------
currentImage.src = ''; 

getGlobalVar('menu').dataset.state = 'initial'; 
wrapApp.dataset.state = '';
hideElement(getGlobalVar('burger'));
wrapApp.removeChild(document.querySelector('.comments__form')); 

getGlobalVar('menu').querySelector('.new').addEventListener('click', uploadFileFromInput); 
wrapApp.addEventListener('drop', onFilesDrop); 
wrapApp.addEventListener('dragover', event => event.preventDefault()); 

// ----------режим "Рецензирование"-----------------------------------------------
getGlobalVar('burger').addEventListener('click', showMenu); 

canvas.addEventListener('click', checkComment); 

document.querySelector('.menu__toggle-title_on').addEventListener('click', markerCheckboxOn);
document.querySelector('#comments-on').addEventListener('click', markerCheckboxOn); 
document.querySelector('.menu__toggle-title_off').addEventListener('click', markerCheckboxOff);
document.querySelector('#comments-off').addEventListener('click', markerCheckboxOff);

getGlobalVar('menu').querySelector('.menu_copy').addEventListener('click', copyUrl); 
urlId(paramId); 

Array.from(getGlobalVar('menu').querySelectorAll('.menu__color')).forEach(color => {
	if (color.checked) {  
		currColor = getComputedStyle(color.nextElementSibling).backgroundColor;  
	}
	color.addEventListener('click', (event) => { 
		currColor = getComputedStyle(event.currentTarget.nextElementSibling).backgroundColor;
	});
});

const ctx = canvas.getContext('2d');
const BRUSH_RADIUS = 4; 
let curves = [];
let drawing = false;
let needsRepaint = false;

canvas.addEventListener("mousedown", (event) => {
	if (!(getGlobalVar('menu').querySelector('.draw').dataset.state === 'selected')) return;
	drawing = true;

	const curve = []; 
	curve.color = currColor;

	curve.push(makePoint(event.offsetX, event.offsetY)); 
	curves.push(curve); 
	needsRepaint = true;
});

canvas.addEventListener("mouseup", (event) => {
	getGlobalVar('menu').style.zIndex = '1';
	drawing = false;
});

canvas.addEventListener("mouseleave", (event) => {
	drawing = false;
});

canvas.addEventListener("mousemove", (event) => {
	if (drawing) {
		getGlobalVar('menu').style.zIndex = '0';
		curves[curves.length - 1].push(makePoint(event.offsetX, event.offsetY));
		needsRepaint = true;
		trottledSendMask();
	}
});

const trottledSendMask = throttle(sendMaskState, 1000);

tick();

function getGlobalStorage() {
	if (typeof (window['globalStorage'] ) === 'undefined') {
		window.globalStorage = {};
	}

	return window.globalStorage;
}

function setGlobalVar(arg) {
	let storage = getGlobalStorage();

	storage[arg] = document.querySelector(`.${arg}`);
}

function getGlobalVar(arg) {
	let storage = getGlobalStorage();

	return storage[arg];
}

function copyUrl() {  
	getGlobalVar('menu').querySelector('.menu__url').select(); 
	try {
		let successful = document.execCommand('copy'); 	
		let msg = successful ? 'успешно ' : 'неуспешно';  
		console.log(`URL ${msg} скопирован`);  
	} catch(err) {  
		console.log('Ошибка копирования');  
	}  
	window.getSelection().removeAllRanges();
}

function delExtension(inputText) { 
	let regExp = new RegExp(/\.[^.]+$/gi);
	return inputText.replace(regExp, '');  
}

function getDate(timestamp) {
	const options = {
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	};
	const date = new Date(timestamp);
	const dateStr = date.toLocaleString('ru-RU', options);

	return dateStr.slice(0, 8) + dateStr.slice(9);
}

function errorRemove() {
	setTimeout(function() {
		hideElement(getGlobalVar('error'))
	}, 10000);
}

function hideElement(el) {
	el.style.display = 'none';
}

function showElement(el) {
	el.style.display = '';
}

function dragStart(event) {
	if (!event.target.classList.contains('drag')) { return; }

	movedPiece = event.target.parentElement;
	minX = wrapApp.offsetLeft;
	minY = wrapApp.offsetTop;
		
	maxX = wrapApp.offsetLeft + wrapApp.offsetWidth - movedPiece.offsetWidth;
	maxY = wrapApp.offsetTop + wrapApp.offsetHeight - movedPiece.offsetHeight;
		
	shiftX = event.pageX - event.target.getBoundingClientRect().left - window.pageXOffset;
	shiftY = event.pageY - event.target.getBoundingClientRect().top - window.pageYOffset;
}

function drag(event) {
	if (!movedPiece) {return; }

	let x = event.pageX - shiftX;
	let y = event.pageY - shiftY;
	x = Math.min(x, maxX);
	y = Math.min(y, maxY);
	x = Math.max(x, minX);
	y = Math.max(y, minY);
	movedPiece.style.left = x + 'px';
	movedPiece.style.top = y + 'px';
}

function drop(evet) {
	if (movedPiece) {
		movedPiece = null;
	}
}

function throttle(func, delay = 0) {
	let isWaiting = false;
	return function () {
		if (!isWaiting) {
	func.apply(this, arguments);	
			isWaiting = true;		
			setTimeout(() => {
				func.apply(this, arguments);		
				isWaiting = false;
			}, delay);
		}
	}
}


// ----------режим "Публикация"---------------------------

function uploadFileFromInput(event) {
	hideElement(getGlobalVar('error'));
	const input = document.createElement('input');
	input.setAttribute('id', 'fileInput');
	input.setAttribute('type', 'file');
	input.setAttribute('accept', 'image/jpeg, image/png');
	hideElement(input);
	getGlobalVar('menu').appendChild(input);

	document.querySelector('#fileInput').addEventListener('change', event => {
		const files = Array.from(event.currentTarget.files);

		if (currentImage.dataset.load === 'load') {
			removeForm();
		}

		sendFile(files);
	});

	input.click();
	getGlobalVar('menu').removeChild(input);
}

function onFilesDrop(event) {
	event.preventDefault();
	hideElement(getGlobalVar('error'));
	const files = Array.from(event.dataTransfer.files);

	if (currentImage.dataset.load === 'load') {
		showElement(getGlobalVar('error'));
		getGlobalVar('error').lastElementChild.textContent = 'Чтобы загрузить новое изображение, пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню';
		errorRemove();
		return;
	}

	files.forEach(file => {
		if ((file.type === 'image/jpeg') || (file.type === 'image/png')) {
			sendFile(files);
		} else {
			showElement(getGlobalVar('error'))
		}
	});
}

function sendFile(files) {
	const formData = new FormData();
	
	files.forEach(file => {
		const fileTitle = delExtension(file.name);
		formData.append('title', fileTitle);
		formData.append('image', file);
    
	});

	showElement(loader);

	fetch(`${urlApi}/pic`, {
			body: formData,
			credentials: 'same-origin',
			method: 'POST'
		})
		.then(res => {
			if (res.status >= 200 && res.status < 300) {
				return res;
			}
			throw new Error (res.statusText);
		})
		.then(res => res.json())
		.then(res => {
			setReview(res.id);
		})
		.catch(er => {
			console.log(er);
			hideElement(loader);
		});
}

function removeForm() {
	const formComment = wrapApp.querySelectorAll('.comments__form');
	Array.from(formComment).forEach(item => {item.remove()})
}


// ---------режим "Публикация"--------------------------------

function setReview(id) {
	const xhrGetInfo = new XMLHttpRequest();
	xhrGetInfo.open(
		'GET',
		`${urlApi}/pic/${id}`,
		false
	);
	xhrGetInfo.send();

	dataGetParse = JSON.parse(xhrGetInfo.responseText);
	localStorage.host = `${window.location.origin}${window.location.pathname}?id=${dataGetParse.id}`;

	wss();	
	setcurrentImage(dataGetParse);
	getGlobalVar('burger').style.cssText = ``;
	showMenu();

	currentImage.addEventListener('load', () => {
		hideElement(loader);
		createWrapforCanvasComment();
		createCanvas();
		currentImage.dataset.load = 'load';
	});

	updateCommentForm(dataGetParse.comments);
}


// ----------режим "Рецензирование"-----------------------------------------------

function showMenu() {
	getGlobalVar('menu').dataset.state = 'default';

	Array.from(getGlobalVar('menu').querySelectorAll('.mode')).forEach(modeItem => {
		modeItem.dataset.state = '';
		modeItem.addEventListener('click', () => {
			
			if (!modeItem.classList.contains('new')){
				getGlobalVar('menu').dataset.state = 'selected';
				modeItem.dataset.state = 'selected';
			}
			
			if (modeItem.classList.contains('share')) {
				getGlobalVar('menu').querySelector('.menu__url').value = localStorage.host;
			}
		})
	})
}

function showMenuComments() {
	getGlobalVar('menu').dataset.state = 'default';

	Array.from(getGlobalVar('menu').querySelectorAll('.mode')).forEach(modeItem => {
		if (!modeItem.classList.contains('comments')) { return; }
			
		getGlobalVar('menu').dataset.state = 'selected';
		modeItem.dataset.state = 'selected';
	})
}

function setcurrentImage(fileInfo) {
	currentImage.src = fileInfo.url;
}


// ------------режим "Комментирование"-----------------

function markerCheckboxOff() {
	const forms = document.querySelectorAll('.comments__form');
	Array.from(forms).forEach(form => {
		form.style.display = 'none';
	 })
}

function markerCheckboxOn() {
	const forms = document.querySelectorAll('.comments__form');
	Array.from(forms).forEach(form => {
		form.style.display = '';
	})
}

function checkComment(event) {
	if (!(getGlobalVar('menu').querySelector('.comments').dataset.state === 'selected') || !wrapApp.querySelector('#comments-on').checked) { return; }
	wrapCommentsCanvas.appendChild(createCommentForm(event.offsetX, event.offsetY));
}

function createCanvas() {
	const width = getComputedStyle(wrapApp.querySelector('.current-image')).width.slice(0, -2);
	const height = getComputedStyle(wrapApp.querySelector('.current-image')).height.slice(0, -2);
	canvas.width = width;
	canvas.height = height;

	canvas.style.width = '100%';
	canvas.style.height = '100%';
	canvas.style.position = 'absolute';
	canvas.style.top = '0';
	canvas.style.left = '0';
	canvas.style.display = 'block';
	canvas.style.zIndex = '1';

	wrapCommentsCanvas.appendChild(canvas);

	curves = [];
    drawing = false;
    needsRepaint = false;
}

function createWrapforCanvasComment() {
	const width = getComputedStyle(wrapApp.querySelector('.current-image')).width;
	const height = getComputedStyle(wrapApp.querySelector('.current-image')).height;
	wrapCommentsCanvas.style.cssText = `
		width: ${width};
		height: ${height};
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: block;
	`;
	wrapApp.appendChild(wrapCommentsCanvas);

	wrapCommentsCanvas.addEventListener('click', event => {
		if (event.target.closest('form.comments__form')) {
			Array.from(wrapCommentsCanvas.querySelectorAll('form.comments__form')).forEach(form => {
				form.style.zIndex = 2;
			});
			event.target.closest('form.comments__form').style.zIndex = 3;
		}
	});
}

function createCommentForm(x, y) {
	const formComment = document.createElement('form');
	formComment.classList.add('comments__form');
	formComment.innerHTML = `
		<span class="comments__marker"></span><input type="checkbox" class="comments__marker-checkbox">
		<div class="comments__body">
			<div class="comment">
				<div class="loader">
					<span></span>
					<span></span>
					<span></span>
					<span></span>
					<span></span>
				</div>
			</div>
			<textarea class="comments__input" type="text" placeholder="Напишите ответ..."></textarea>
			<input class="comments__close" type="button" value="Закрыть">
			<input class="comments__submit" type="submit" value="Отправить">
		</div>`;
	const left = x - 22;
	const top = y - 14;

	formComment.style.cssText = `
		top: ${top}px;
		left: ${left}px;
		z-index: 2;
	`;
	formComment.dataset.left = left;
	formComment.dataset.top = top;

	hideElement(formComment.querySelector('.loader').parentElement);

	formComment.querySelector('.comments__close').addEventListener('click', () => {
		formComment.querySelector('.comments__marker-checkbox').checked = false;
	});

	formComment.addEventListener('submit', messageSend);
	formComment.querySelector('.comments__input').addEventListener('keydown', keySendMessage);

	function keySendMessage(event) {
		if (event.repeat) { return; }
		if (!event.ctrlKey) { return; }

		switch (event.code) {
			case 'Enter':
				messageSend();
			break;
		}
	}

	function messageSend(event) {
		if (event) {
			event.preventDefault();
		}
		const message = formComment.querySelector('.comments__input').value;
		const messageSend = `message=${encodeURIComponent(message)}&left=${encodeURIComponent(left)}&top=${encodeURIComponent(top)}`;
		commentsSend(messageSend);
		showElement(loaderComment.parentElement);
		formComment.querySelector('.comments__input').value = '';
	}

	function commentsSend(message) {
		fetch(`${urlApi}/pic/${dataGetParse.id}/comments`, {
				method: 'POST',
				body: message,
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
			})
			.then( res => {
				if (res.status >= 200 && res.status < 300) {
					return res;
				}
				throw new Error (res.statusText);
			})
			.then(res => res.json())
			.catch(er => {
				console.log(er);
				formComment.querySelector('.loader').parentElement.style.display = 'none';
			});
	}

	return formComment;
}

function addMessageComment(message, form) {
	let parentLoaderDiv = form.querySelector('.loader').parentElement;

	const newMessageDiv = document.createElement('div');
	newMessageDiv.classList.add('comment');
	newMessageDiv.dataset.timestamp = message.timestamp;
		
	const commentTimeP = document.createElement('p');
	commentTimeP.classList.add('comment__time');
	commentTimeP.textContent = getDate(message.timestamp);
	newMessageDiv.appendChild(commentTimeP);

	const commentMessageP = document.createElement('p');
	commentMessageP.classList.add('comment__message');
	commentMessageP.textContent = message.message;
	newMessageDiv.appendChild(commentMessageP);

	form.querySelector('.comments__body').insertBefore(newMessageDiv, parentLoaderDiv);
}

function updateCommentForm(newComment) {
	if (!newComment) return;
	Object.keys(newComment).forEach(id => {
		if (id in showComments) return;
			
		showComments[id] = newComment[id];
		let needCreateNewForm = true;

		Array.from(wrapApp.querySelectorAll('.comments__form')).forEach(form => {
		  if (+form.dataset.left === showComments[id].left && +form.dataset.top === showComments[id].top) {
				form.querySelector('.loader').parentElement.style.display = 'none';
				addMessageComment(newComment[id], form); 
				needCreateNewForm = false;
			}
		});

		if (needCreateNewForm) {
			const newForm = createCommentForm(newComment[id].left + 22, newComment[id].top + 14);
			newForm.dataset.left = newComment[id].left;
			newForm.dataset.top = newComment[id].top;
			newForm.style.left = newComment[id].left + 'px';
			newForm.style.top = newComment[id].top + 'px';
			wrapCommentsCanvas.appendChild(newForm);
			addMessageComment(newComment[id], newForm);

			if (!wrapApp.querySelector('#comments-on').checked) {
				newForm.style.display = 'none';
			}
		}
	});
}

function insertWssCommentForm(wssComment) {
	const wsCommentEdited = {};
	wsCommentEdited[wssComment.id] = {};
	wsCommentEdited[wssComment.id].left = wssComment.left;
	wsCommentEdited[wssComment.id].message = wssComment.message;
	wsCommentEdited[wssComment.id].timestamp = wssComment.timestamp;
	wsCommentEdited[wssComment.id].top = wssComment.top;
	updateCommentForm(wsCommentEdited);
}

function wss() {
	connection = new WebSocket(`wss://neto-api.herokuapp.com/pic/${dataGetParse.id}`);
	connection.addEventListener('message', event => {
		if (JSON.parse(event.data).event === 'pic'){
			if (JSON.parse(event.data).pic.mask) {
				canvas.style.background = `url(${JSON.parse(event.data).pic.mask})`;
			} else {
				canvas.style.background = ``;
			}
		}

		if (JSON.parse(event.data).event === 'comment'){
			insertWssCommentForm(JSON.parse(event.data).comment);
		}

		if (JSON.parse(event.data).event === 'mask'){
			canvas.style.background = `url(${JSON.parse(event.data).url})`;
		}
	});
}

function urlId(id) {
	if (!id) { return;	}
	setReview(id);
	showMenuComments();
}

function circle(point) {
	ctx.beginPath();
	ctx.arc(...point, BRUSH_RADIUS / 2, 0, 2 * Math.PI);
	ctx.fill();
}

function smoothCurveBetween (p1, p2) {
	const cp = p1.map((coord, idx) => (coord + p2[idx]) / 2);
	ctx.quadraticCurveTo(...p1, ...cp);
}

function smoothCurve(points) {
	ctx.beginPath();
	ctx.lineWidth = BRUSH_RADIUS;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	ctx.moveTo(...points[0]);

	for(let i = 1; i < points.length - 1; i++) {
		smoothCurveBetween(points[i], points[i + 1]);
	}

	ctx.stroke();
}

function makePoint(x, y) {
	return [x, y];
}

function repaint () {
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	curves.forEach((curve) => {
		ctx.strokeStyle = curve.color;
		ctx.fillStyle = curve.color;

		circle(curve[0]);
		smoothCurve(curve);
	});
}

function sendMaskState() {
	canvas.toBlob(function (blob) {
		connection.send(blob);
		console.log(connection)
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	});
}

function tick () {
	
	if (getGlobalVar('menu').offsetHeight > 66) {
		getGlobalVar('menu').style.left = (wrapApp.offsetWidth - getGlobalVar('menu').offsetWidth) - 10 + 'px';
	}

	if(needsRepaint) {
		repaint();
		needsRepaint = false;
	}

	window.requestAnimationFrame(tick);
}
