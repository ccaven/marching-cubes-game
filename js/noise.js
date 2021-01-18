/* https://github.com/blindman67/SimplexNoiseJS  */
function openSimplexNoise(clientSeed) {
	const SQ4 = 2
	const toNums = (s) => s.split(",").map((s) => new Uint8Array(s.split("").map((v) => Number(v) )) );
	const decode = (m, r, s) => new Int8Array(s.split("").map((v) => parseInt(v, r) + m ));
	const toNumsB32 = (s) => s.split(",").map((s) => parseInt(s, 32));
	const NORM_3D = 1.0 / 206.0
	const SQUISH_3D = 1 / 3
	const STRETCH_3D = -1 / 6
	let base3D = toNums("0000110010101001,2110210120113111,110010101001211021012011")
	const gradients3D = decode(-11, 23, "0ff7mf7fmmfffmfffm07f70f77mm7ff0ff7m0f77m77f0mf7fm7ff0077707770m77f07f70")
	let lookupPairs3D = function() { return new Uint16Array(toNumsB32("0,2,1,1,2,2,5,1,6,0,7,0,10,2,12,2,41,1,45,1,50,5,51,5,g6,0,g7,0,h2,4,h6,4,k5,3,k7,3,l0,5,l1,5,l2,4,l5,3,l6,4,l7,3,l8,d,l9,d,la,c,ld,e,le,c,lf,e,m8,k,ma,i,p9,l,pd,n,q8,k,q9,l,15e,j,15f,m,16a,i,16e,j,19d,n,19f,m,1a8,f,1a9,h,1aa,f,1ad,h,1ae,g,1af,g,1ag,b,1ah,a,1ai,b,1al,a,1am,9,1an,9,1bg,b,1bi,b,1eh,a,1el,a,1fg,8,1fh,8,1qm,9,1qn,9,1ri,7,1rm,7,1ul,6,1un,6,1vg,8,1vh,8,1vi,7,1vl,6,1vm,7,1vn,6")) }
	let p3D = decode(-1, 5, "112011210110211120110121102132212220132122202131222022243214231243124213241324123222113311221213131221123113311112202311112022311112220342223113342223311342223131322023113322023311320223113320223131322203311322203131")
	const setOf = function(count) { let a = [],i = 0; while (i < count) { a.push(i++) } return a }
	const doFor = function(count, cb) { let i = 0; while (i < count && cb(i++) !== true) {} }

	function shuffleSeed(seed,count){
		seed = seed * 1664525 + 1013904223 | 0
		count -= 1
		return count > 0 ? shuffleSeed(seed, count) : seed
	}
	const types = {
		_3D : {
			base : base3D,
			squish : SQUISH_3D,
			dimensions : 3,
			pD : p3D,
			lookup : lookupPairs3D,
		}
	}

	function createContribution(type, baseSet, index) {
		let i = 0
		const multiplier = baseSet[index ++]
		const c = { next : undefined }
		while(i < type.dimensions) {
			const axis = ("xyzw")[i]
			c[axis + "sb"] = baseSet[index + i]
			c["d" + axis] = - baseSet[index + i++] - multiplier * type.squish
		}
		return c
	}

	function createLookupPairs(lookupArray, contributions){
		let i
		const a = lookupArray()
		const res = new Map()
		for (i = 0; i < a.length; i += 2) { res.set(a[i], contributions[a[i + 1]]); }
		return res
	}

	function createContributionArray(type) {
		const conts = []
		const d = type.dimensions
		const baseStep = d * d
		let k, i = 0
		while (i < type.pD.length) {
			const baseSet = type.base[type.pD[i]]
			let previous, current
			k = 0
			do {
				current = createContribution(type, baseSet, k)
				if (!previous) conts[i / baseStep] = current;
				else previous.next = current;
				previous = current
				k += d + 1
			} while(k < baseSet.length)

			current.next = createContribution(type, type.pD, i + 1)
			if (d >= 3) current.next.next = createContribution(type, type.pD, i + d + 2);
			if (d === 4) current.next.next.next = createContribution(type, type.pD, i + 11);
			i += baseStep
		}
		const result = [conts, createLookupPairs(type.lookup, conts)]
		type.base = undefined
		type.lookup = undefined
		return result
	}

	let temp = createContributionArray(types._3D)
	const contributions3D = temp[0], lookup3D = temp[1]
	const perm = new Uint8Array(256)
	const perm3D = new Uint8Array(256)
	const source = new Uint8Array(setOf(256))
	let seed = shuffleSeed(clientSeed, 3)
	doFor(256, function(i) {
		i = 255 - i
		seed = shuffleSeed(seed, 1)
		let r = (seed + 31) % (i + 1)
		r += r < 0 ? i + 1 : 0
		perm[i] = source[r]
		perm3D[i] = (perm[i] % 24) * 3
		source[r] = source[i]
	})
	base3D = undefined
	lookupPairs3D = undefined
	p3D = undefined

	return function(x, y, z) {
		const pD = perm3D
		const p = perm
		const g = gradients3D
		const stretchOffset = (x + y + z) * STRETCH_3D
		const xs = x + stretchOffset, ys = y + stretchOffset, zs = z + stretchOffset
		const xsb = Math.floor(xs), ysb = Math.floor(ys), zsb = Math.floor(zs)
		const squishOffset	= (xsb + ysb + zsb) * SQUISH_3D
		const dx0 = x - (xsb + squishOffset), dy0 = y - (ysb + squishOffset), dz0 = z - (zsb + squishOffset)
		const xins = xs - xsb, yins = ys - ysb, zins = zs - zsb
		const inSum = xins + yins + zins
		let c = lookup3D.get(
			(yins - zins + 1) |
			((xins - yins + 1) << 1) |
			((xins - zins + 1) << 2) |
			(inSum << 3) |
			((inSum + zins) << 5) |
			((inSum + yins) << 7) |
			((inSum + xins) << 9)
		)
		let i, value = 0
		while (c !== undefined) {
			const dx = dx0 + c.dx, dy = dy0 + c.dy, dz = dz0 + c.dz
			let attn = 2 - dx * dx - dy * dy - dz * dz
			if (attn > 0) {
				i = pD[(((p[(xsb + c.xsb) & 0xFF] + (ysb + c.ysb)) & 0xFF) + (zsb + c.zsb)) & 0xFF]
				attn *= attn
				value += attn * attn * (g[i++] * dx + g[i++] * dy + g[i] * dz)
			}
			c = c.next
		}
		return value * NORM_3D + 0.5
	}
}

const noiseGenerator = openSimplexNoise(0);

function noise3D (x, y, z, octaves=4) {
    let scl = 1.0, v = 0.0;
    for (let i = 0; i < octaves; i ++) {
        v += noiseGenerator(x * scl, y * scl, z * scl) / scl * 0.5;
        scl *= 2.0;
    }
    return v;
}