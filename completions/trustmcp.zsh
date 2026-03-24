#compdef trustmcp

_trustmcp() {
  local curcontext="$curcontext" state line
  local -a formats severities options
  local -i has_target=0 skip_next=0 index
  local subcommand=""
  local arg

  formats=(text json markdown sarif)
  severities=(low medium high)
  options=(--help -h --version -v --json --format --config --fail-on --summary-only --output-file)

  _arguments -C -s -S \
    '(-h --help)'{-h,--help}'[Show help]' \
    '(-v --version)'{-v,--version}'[Show TrustMCP version]' \
    '--json[Use JSON output shorthand]' \
    '--format=-[Select output format]:format:(text json markdown sarif)' \
    '--config=-[Load JSON config defaults]:config file:_files' \
    '--fail-on=-[Fail when findings meet the severity threshold]:severity:(low medium high)' \
    '--summary-only[Emit only the top-line summary]' \
    '--output-file=-[Write the rendered report to a file]:output file:_files' \
    '*::argument:->args'

  case "$state" in
    args)
      for (( index=1; index<CURRENT; index+=1 )); do
        arg="${words[index]}"

        if (( skip_next )); then
          skip_next=0
          continue
        fi

        case "$arg" in
          init-config|doctor|version)
            subcommand="$arg"
            ;;
          --format|--config|--fail-on|--output-file)
            skip_next=1
            ;;
          --format=*|--config=*|--fail-on=*|--output-file=*|--json|--summary-only|-h|--help|-v|--version|scan)
            ;;
          -*)
            ;;
          *)
            if [[ "$subcommand" != "init-config" ]]; then
              has_target=1
            fi
            ;;
        esac
      done

      if [[ "${words[1]}" == "init-config" ]]; then
        if (( CURRENT == 2 )); then
          _files
        fi
        return
      fi

      if [[ "${words[1]}" == "doctor" ]]; then
        if (( CURRENT == 2 )); then
          _files -/
        elif [[ "${words[CURRENT-1]}" == "--config" ]]; then
          _files
        elif [[ "${words[CURRENT]}" == --config=* ]]; then
          _files
        else
          compadd -- --config
        fi
        return
      fi

      if [[ "${words[1]}" == "list-rules" ]]; then
        return
      fi

      if [[ "${words[1]}" == "version" ]]; then
        return
      fi

      if (( has_target == 0 )); then
        _alternative \
          'subcommand:subcommand:(scan doctor init-config list-rules version)' \
          'option:option:compadd -- --help -h --version -v --json --format --config --fail-on --summary-only --output-file' \
          'directory:directory:_files -/'
        return
      fi

      compadd -- --help -h --version -v --json --format --config --fail-on --summary-only --output-file
      ;;
  esac
}

compdef _trustmcp trustmcp
