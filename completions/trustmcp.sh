_trustmcp_add_word_matches() {
  local words="$1"
  local current="$2"
  while IFS= read -r match; do
    COMPREPLY+=("$match")
  done < <(compgen -W "$words" -- "$current")
}

_trustmcp_add_prefixed_word_matches() {
  local prefix="$1"
  local words="$2"
  local current="$3"
  while IFS= read -r match; do
    COMPREPLY+=("${prefix}${match}")
  done < <(compgen -W "$words" -- "$current")
}

_trustmcp_add_file_matches() {
  local prefix="$1"
  local current="$2"
  while IFS= read -r match; do
    COMPREPLY+=("${prefix}${match}")
  done < <(compgen -f -- "$current")
}

_trustmcp_add_directory_matches() {
  local current="$1"
  while IFS= read -r match; do
    COMPREPLY+=("$match")
  done < <(compgen -d -- "$current")
}

_trustmcp() {
  local cur prev arg
  local -i has_target=0 skip_next=0 i
  local formats="text json markdown sarif"
  local severities="low medium high"
  local flags="--help -h --json --format --config --fail-on --summary-only --output-file"

  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev=""
  if (( COMP_CWORD > 0 )); then
    prev="${COMP_WORDS[COMP_CWORD-1]}"
  fi

  case "$prev" in
    --format)
      _trustmcp_add_word_matches "$formats" "$cur"
      return
      ;;
    --fail-on)
      _trustmcp_add_word_matches "$severities" "$cur"
      return
      ;;
    --config|--output-file)
      _trustmcp_add_file_matches "" "$cur"
      return
      ;;
  esac

  case "$cur" in
    --format=*)
      _trustmcp_add_prefixed_word_matches "--format=" "$formats" "${cur#--format=}"
      return
      ;;
    --fail-on=*)
      _trustmcp_add_prefixed_word_matches "--fail-on=" "$severities" "${cur#--fail-on=}"
      return
      ;;
    --config=*)
      _trustmcp_add_file_matches "--config=" "${cur#--config=}"
      return
      ;;
    --output-file=*)
      _trustmcp_add_file_matches "--output-file=" "${cur#--output-file=}"
      return
      ;;
  esac

  for (( i=1; i<COMP_CWORD; i+=1 )); do
    arg="${COMP_WORDS[i]}"

    if (( skip_next )); then
      skip_next=0
      continue
    fi

    case "$arg" in
      --format|--config|--fail-on|--output-file)
        skip_next=1
        ;;
      --format=*|--config=*|--fail-on=*|--output-file=*|--json|--summary-only|-h|--help|scan)
        ;;
      -*)
        ;;
      *)
        has_target=1
        ;;
    esac
  done

  if (( has_target == 0 )); then
    _trustmcp_add_word_matches "scan $flags" "$cur"
    _trustmcp_add_directory_matches "$cur"
    return
  fi

  _trustmcp_add_word_matches "$flags" "$cur"
}

complete -F _trustmcp trustmcp
