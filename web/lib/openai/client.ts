import OpenAI from 'openai'

let instance: OpenAI | undefined

// Created on first use so a missing key fails the request, not the build.
export const openai = new Proxy({} as OpenAI, {
	get(_target, prop) {
		instance ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
		return Reflect.get(instance, prop)
	},
})
