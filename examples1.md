Motivational qoutes card: document.addEventListener("DOMContentLoaded", () => {
	const track = document.querySelector(".carousel-track");
	const cards = document.querySelectorAll(".deconstructed-card");
	const prevBtn = document.querySelector(".carousel-button.prev");
	const nextBtn = document.querySelector(".carousel-button.next");
	const dotsContainer = document.querySelector(".dots-container");

	cards.forEach((_, index) => {
		const dot = document.createElement("div");
		dot.classList.add("dot");
		if (index === 0) dot.classList.add("active");
		dot.addEventListener("click", () => goToCard(index));
		dotsContainer.appendChild(dot);
	});

	const dots = document.querySelectorAll(".dot");

	const cardWidth = cards[0].offsetWidth;
	const cardMargin = 40;
	const totalCardWidth = cardWidth + cardMargin;

	let currentIndex = 0;

	cards.forEach((card) => {
		card.addEventListener("mousemove", (e) => {
			const rect = card.getBoundingClientRect();
			const x = (e.clientX - rect.left) / rect.width;
			const y = (e.clientY - rect.top) / rect.height;
			const xDeg = (y - 0.5) * 8;
			const yDeg = (x - 0.5) * -8;
			card.style.transform = `perspective(1200px) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`;
			const layers = card.querySelectorAll(".card-layer");
			layers.forEach((layer, index) => {
				const depth = 30 * (index + 1);
				const translateZ = depth;
				const offsetX = (x - 0.5) * 10 * (index + 1);
				const offsetY = (y - 0.5) * 10 * (index + 1);
				layer.style.transform = `translate3d(${offsetX}px, ${offsetY}px, ${translateZ}px)`;
			});
			const waveSvg = card.querySelector(".wave-svg");
			if (waveSvg) {
				const moveX = (x - 0.5) * -20;
				const moveY = (y - 0.5) * -20;
				waveSvg.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.05)`;
				const wavePaths = waveSvg.querySelectorAll("path:not(:first-child)");
				wavePaths.forEach((path, index) => {
					const factor = 1 + index * 0.5;
					const waveX = moveX * factor * 0.5;
					const waveY = moveY * factor * 0.3;
					path.style.transform = `translate(${waveX}px, ${waveY}px)`;
				});
			}
			const bgObjects = card.querySelectorAll(".bg-object");
			bgObjects.forEach((obj, index) => {
				const factorX = (index + 1) * 10;
				const factorY = (index + 1) * 8;
				const moveX = (x - 0.5) * factorX;
				const moveY = (y - 0.5) * factorY;
				if (obj.classList.contains("square")) {
					obj.style.transform = `rotate(45deg) translate(${moveX}px, ${moveY}px)`;
				} else if (obj.classList.contains("triangle")) {
					obj.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px)) scale(1)`;
				} else {
					obj.style.transform = `translate(${moveX}px, ${moveY}px)`;
				}
			});
		});

		card.addEventListener("mouseleave", () => {
			card.style.transform = "";
			const layers = card.querySelectorAll(".card-layer");
			layers.forEach((layer) => {
				layer.style.transform = "";
			});
			const waveSvg = card.querySelector(".wave-svg");
			if (waveSvg) {
				waveSvg.style.transform = "";
				const wavePaths = waveSvg.querySelectorAll("path:not(:first-child)");
				wavePaths.forEach((path) => {
					path.style.transform = "";
				});
			}
			const bgObjects = card.querySelectorAll(".bg-object");
			bgObjects.forEach((obj) => {
				if (obj.classList.contains("square")) {
					obj.style.transform = "rotate(45deg) translateY(-20px)";
				} else if (obj.classList.contains("triangle")) {
					obj.style.transform = "translate(-50%, -50%) scale(0.5)";
				} else {
					obj.style.transform = "translateY(20px)";
				}
			});
		});
	});

	function goToCard(index) {
		index = Math.max(0, Math.min(index, cards.length - 1));

		currentIndex = index;
		updateCarousel();
	}

	function updateCarousel() {
		const translateX = -currentIndex * totalCardWidth;

		track.style.transform = `translateX(${translateX}px)`;

		dots.forEach((dot, index) => {
			dot.classList.toggle("active", index === currentIndex);
		});
	}

	prevBtn.addEventListener("click", () => {
		goToCard(currentIndex - 1);
	});

	nextBtn.addEventListener("click", () => {
		goToCard(currentIndex + 1);
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "ArrowLeft") {
			goToCard(currentIndex - 1);
		} else if (e.key === "ArrowRight") {
			goToCard(currentIndex + 1);
		}
	});

	let touchStartX = 0;
	let touchEndX = 0;

	track.addEventListener("touchstart", (e) => {
		touchStartX = e.changedTouches[0].screenX;
	});

	track.addEventListener("touchend", (e) => {
		touchEndX = e.changedTouches[0].screenX;
		handleSwipe();
	});

	function handleSwipe() {
		if (touchStartX - touchEndX > 50) {
			goToCard(currentIndex + 1);
		} else if (touchEndX - touchStartX > 50) {
			goToCard(currentIndex - 1);
		}
	}

	window.addEventListener("resize", () => {
		const newCardWidth = cards[0].offsetWidth;
		const newTotalCardWidth = newCardWidth + cardMargin;

		const translateX = -currentIndex * newTotalCardWidth;
		track.style.transition = "none";
		track.style.transform = `translateX(${translateX}px)`;

		setTimeout(() => {
			track.style.transition = "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
		}, 50);
	});

	updateCarousel();
});


For xp cards:

const $wrap = document.querySelector(".card-wrapper");
const $card = document.querySelector("#card");

const cardUpdate = (e) => {
  // normalise touch/mouse
  var pos = [e.offsetX, e.offsetY];
  if (e.pointerType === "touch") {
    e.preventDefault;
  }
  var dimensions = $card.getBoundingClientRect();
  // math for mouse position
  var l = pos[0];
  var t = pos[1];
  var h = dimensions.height;
  var w = dimensions.width;
  var px = clamp(Math.abs((100 / w) * l), 0, 100);
  var py = clamp(Math.abs((100 / h) * t), 0, 100);
  var cx = px - 50;
  var cy = py - 50;

  $wrap.setAttribute(
    "style",
    `
      --pointer-x: ${px}%;
      --pointer-y: ${py}%;
      --background-x: ${adjust(px, 0, 100, 35, 65)}%;
      --background-y: ${adjust(py, 0, 100, 35, 65)}%;
      --pointer-from-center: ${clamp(
        Math.sqrt((py - 50) * (py - 50) + (px - 50) * (px - 50)) / 50,
        0,
        1
      )};
      --pointer-from-top: ${py / 100};
      --pointer-from-left: ${px / 100};
      --rotate-x: ${round(-(cx / 5))}deg;
      --rotate-y: ${round(cy / 4)}deg;
    `
  );
};

function ease(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easedFunc(durationMs, onProgress, onComplete, onCancel) {
  let startTime = performance.now();
  let canceled = false;

  function loop() {
    if (canceled) return;
    const currentTime = performance.now();
    const progress = (currentTime - startTime) / durationMs;
    const easedProgress = ease(progress);
    onProgress(easedProgress);
    if (progress < 1) {
      requestAnimationFrame(loop);
    } else {
      if (onComplete) onComplete();
    }
  }

  loop();

  return {
    cancel: () => {
      canceled = true;
    }
  };
}

/**
 * return a value that has been rounded to a set precision
 * @param {Number} value the value to round
 * @param {Number} precision the precision (decimal places), default: 3
 * @returns {Number}
 */
const round = (value, precision = 3) => parseFloat(value.toFixed(precision));

/**
 * return a value that has been limited between min & max
 * @param {Number} value the value to clamp
 * @param {Number} min minimum value to allow, default: 0
 * @param {Number} max maximum value to allow, default: 100
 * @returns {Number}
 */
const clamp = (value, min = 0, max = 100) => {
  return Math.min(Math.max(value, min), max);
};

/**
 * return a value that has been re-mapped according to the from/to
 * - for example, adjust(10, 0, 100, 100, 0) = 90
 * @param {Number} value the value to re-map (or adjust)
 * @param {Number} fromMin min value to re-map from
 * @param {Number} fromMax max value to re-map from
 * @param {Number} toMin min value to re-map to
 * @param {Number} toMax max value to re-map to
 * @returns {Number}
 */
const adjust = (value, fromMin, fromMax, toMin, toMax) => {
  return round(
    toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin)
  );
};

const halfW = $wrap.clientWidth / 2;
const halfH = $wrap.clientHeight / 2;

let easer;
$card.addEventListener("pointerenter", () => {
  if (easer) {
    easer?.cancel?.();
  }
});
$card.addEventListener("pointermove", cardUpdate);
$card.addEventListener("pointerout", (e) => {
  easer = easedFunc(
    1000,
    (p) => {
      let x = adjust(p, 0, 1, e.offsetX, halfW);
      let y = adjust(p, 0, 1, e.offsetY, halfH);
      cardUpdate({ offsetX: x, offsetY: y });
    },
    () => {
      $card.classList.remove("active");
      $wrap.classList.remove("active");
    }
  );
});

cardUpdate({ offsetX: $wrap.clientWidth - 70, offsetY: 60 });

setTimeout(() => {
  easer = easedFunc(
    3000,
    (p) => {
      let x = adjust(p, 0, 1, $wrap.clientWidth - 70, halfW);
      let y = adjust(p, 0, 1, 60, halfH);
      cardUpdate({ offsetX: x, offsetY: y });
    },
    () => {
      $card.classList.remove("active");
      $wrap.classList.remove("active");
    }
  );
}, 1000);

Other cards:

import { animate, hover } from "https://cdn.jsdelivr.net/npm/motion@latest/+esm"

const eye = document.querySelector(".eye"),
			eyeBall=document.querySelector(".eye-ball")

const seq = [
	[eyeBall, { "--moveX": [0,-1,1,0], "--moveY":[0,1,1,0] }, {duration: 2}],
	[eyeBall, { scaleY: [1,0,1] }, {duration: .5}]
]

animate(eye, { "--hoverY":[0,-1,0] }, {duration: 2, repeat: Infinity, ease: "easeInOut"})
animate(seq,{ repeat: Infinity ,repeatDelay: 1})

hover(".button", (ele) => {
  animate(ele, {scale: .9})
  
	
  return () => {
    animate(ele, {scale: 1})
  }
})