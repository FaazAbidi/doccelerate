import { Octokit } from "@octokit/rest"

export function getOctokit(accessToken: string) {
  return new Octokit({ auth: accessToken })
}
